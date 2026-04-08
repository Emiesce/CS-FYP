#!/usr/bin/env python3
"""
Essay Grading API using RAG System
Provides REST API endpoints for AI-powered essay grading
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import logging
import asyncio
import os
import json
from datetime import datetime
from functools import wraps
import sys
from pathlib import Path

# Load .env file before anything else
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv not installed, rely on system env vars

# Add project root to path so 'src' is importable as a package
sys.path.insert(0, str(Path(__file__).parent))

try:
    # Import as package members (src is a package, grading_system uses relative imports)
    from src.grading_system import create_system, create_azure_system, create_test_system
    from src.models.grading_models import EssayGradingRequest, GradingRequest
    from src.services.lecture_notes_service import LectureNotesService
    from src.utils.lecture_notes_storage import get_default_lecture_notes_storage
    GRADING_AVAILABLE = True
    LECTURE_NOTES_AVAILABLE = True
except ImportError as e:
    print(f"Warning: Grading system not available: {e}")
    GRADING_AVAILABLE = False
    LECTURE_NOTES_AVAILABLE = False

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=False)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global grading system instance
grading_system = None

# Global lecture notes service instance
lecture_notes_service = None


def async_route(f):
    """Decorator to handle async routes in Flask"""
    @wraps(f)
    def wrapper(*args, **kwargs):
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(f(*args, **kwargs))
        finally:
            loop.close()
    return wrapper


async def get_grading_system():
    """Get or create the grading system instance"""
    global grading_system
    if grading_system is None and GRADING_AVAILABLE:
        try:
            logger.info("Initializing grading system...")
            grading_system = await create_system()
            logger.info("Grading system initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize grading system: {e}")
            raise
    return grading_system


async def get_lecture_notes_service():
    """Get or create the lecture notes service instance"""
    global lecture_notes_service
    if lecture_notes_service is None and LECTURE_NOTES_AVAILABLE:
        try:
            logger.info("Initializing lecture notes service...")
            storage = get_default_lecture_notes_storage()
            # Get grading system for RAG integration
            rag_system = await get_grading_system() if GRADING_AVAILABLE else None
            lecture_notes_service = LectureNotesService(storage=storage, rag_system=rag_system)
            logger.info("Lecture notes service initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize lecture notes service: {e}")
            raise
    return lecture_notes_service


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'grading_available': GRADING_AVAILABLE,
        'timestamp': datetime.now().isoformat()
    })


@app.route('/grade-answer', methods=['POST'])
@async_route
async def grade_answer():
    """
    Grade a student answer using the RAG system (supports all exam types)
    
    Request body:
    {
        "student_id": "20841234",
        "student_name": "John Smith",
        "answer": "Student answer content...",
        "marking_scheme_id": "rubric-1",
        "assignment_id": "midterm",
        "course_id": "MGMT2011",
        "submitted_at": "2024-01-15T10:00:00Z"
    }
    
    Response:
    {
        "data": {
            "studentID": "20841234",
            "studentName": "John Smith",
            "examId": "midterm",
            "examTitle": "MGMT2011 Midterm Exam",
            "courseId": "MGMT2011",
            "submittedAt": "2024-01-15T10:00:00Z",
            "gradedAt": "2024-01-16T14:30:00Z",
            "status": "graded",
            "questions": [...],
            "summary": {...}
        },
        "success": true,
        "message": "Exam results processed successfully"
    }
    """
    if not GRADING_AVAILABLE:
        return jsonify({
            'success': False,
            'error': 'Grading system not available'
        }), 503
    
    try:
        # Validate request
        if not request.is_json:
            return jsonify({
                'success': False,
                'error': 'Request must be JSON'
            }), 400
        
        data = request.get_json()
        
        # Validate required fields (support both 'answer' and legacy 'essay_text')
        required_fields = ['student_id', 'marking_scheme_id']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'error': f'Missing required field: {field}'
                }), 400
        
        # Check for answer field (support both 'answer' and legacy 'essay_text')
        if 'answer' not in data and 'essay_text' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing required field: answer (or essay_text for backward compatibility)'
            }), 400
        
        # Create grading request
        from src.models.grading_models import GradingRequest
        grading_request = GradingRequest(
            student_id=data['student_id'],
            answer=data.get('answer') or data.get('essay_text'),
            marking_scheme_id=data['marking_scheme_id'],
            student_name=data.get('student_name'),
            assignment_id=data.get('assignment_id'),
            course_id=data.get('course_id'),
            submitted_at=data.get('submitted_at')
        )
        
        # Get grading system
        system = await get_grading_system()
        
        # Grade the answer (save_result=True will store in comprehensive format)
        response = await system.grade_answer(grading_request, save_result=True)
        
        # Get the stored result in comprehensive exam format
        stored_results = system.get_student_results(data['student_id'])
        if stored_results:
            # Return the latest result in the comprehensive format
            return jsonify(stored_results[-1])
        else:
            # Fallback to basic response format
            return jsonify({
                'success': True,
                'data': {
                    'student_id': response.student_id,
                    'total_score': response.total_score,
                    'max_total_score': response.max_total_score,
                    'percentage': round((response.total_score / response.max_total_score) * 100, 1),
                    'processed_at': response.processed_at.isoformat() if hasattr(response.processed_at, 'isoformat') else str(response.processed_at),
                    'criteria_results': [
                        {
                            'criterion_id': c.criterion_id,
                            'criterion_name': c.criterion_name,
                            'score': c.score,
                            'max_score': c.max_score,
                            'justification': c.justification,
                            'suggestion': c.suggestion_for_improvement
                        } for c in response.results
                    ]
                },
                'message': 'Answer graded successfully'
            })
            
    except Exception as e:
        logger.error(f"Error grading answer: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# Backward compatibility endpoint
@app.route('/grade-essay', methods=['POST'])
@async_route
async def grade_essay():
    """Backward compatibility endpoint. Use /grade-answer instead."""
    return await grade_answer()


@app.route('/grading-results/<student_id>', methods=['GET'])
@async_route
async def get_student_results(student_id):
    """
    Get all grading results for a specific student
    
    Response:
    {
        "success": true,
        "data": [...],
        "count": 2,
        "message": "Found 2 results for student 20841234"
    }
    """
    if not GRADING_AVAILABLE:
        return jsonify({
            'success': False,
            'error': 'Grading system not available'
        }), 503
    
    try:
        system = await get_grading_system()
        results = system.get_student_results(student_id)
        
        return jsonify({
            'success': True,
            'data': results,
            'count': len(results),
            'message': f'Found {len(results)} results for student {student_id}'
        })
        
    except Exception as e:
        logger.error(f"Error getting student results: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/grading-results', methods=['GET'])
@async_route
async def get_all_grading_results():
    """
    Get all grading results with optional filtering
    
    Query parameters:
    - assignment_id: Filter by assignment
    - course_id: Filter by course
    - marking_scheme_id: Filter by marking scheme
    
    Response:
    {
        "success": true,
        "data": [...],
        "count": 10,
        "message": "Found 10 grading results"
    }
    """
    if not GRADING_AVAILABLE:
        return jsonify({
            'success': False,
            'error': 'Grading system not available'
        }), 503
    
    try:
        system = await get_grading_system()
        
        # Check for query parameters
        assignment_id = request.args.get('assignment_id')
        marking_scheme_id = request.args.get('marking_scheme_id')
        
        if assignment_id:
            results = system.get_assignment_results(assignment_id)
            message = f'Found {len(results)} results for assignment {assignment_id}'
        elif marking_scheme_id:
            results = system.get_marking_scheme_results(marking_scheme_id)
            message = f'Found {len(results)} results for marking scheme {marking_scheme_id}'
        else:
            results = system.get_all_grading_results()
            message = f'Found {len(results)} grading results'
        
        return jsonify({
            'success': True,
            'data': results,
            'count': len(results),
            'message': message
        })
        
    except Exception as e:
        logger.error(f"Error getting grading results: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/grading-results/update', methods=['PUT'])
@async_route
async def update_grading_result():
    """
    Update manual scores in a grading result.

    Request body:
    {
        "result_id": "grade_20260322_...",
        "student_id": "20841234",
        "updates": [
            {
                "question_index": 0,
                "criterion_index": 0,
                "manual_score": 8.5
            }
        ]
    }
    """
    if not GRADING_AVAILABLE:
        return jsonify({'success': False, 'error': 'Grading system not available'}), 503

    try:
        if not request.is_json:
            return jsonify({'success': False, 'error': 'Request must be JSON'}), 400

        data = request.get_json()
        student_id = data.get('student_id')
        result_id = data.get('result_id')
        updates = data.get('updates', [])

        if not student_id:
            return jsonify({'success': False, 'error': 'student_id is required'}), 400

        system = await get_grading_system()

        # Find the result to update
        results = system.get_student_results(student_id)
        target = None
        for r in results:
            if result_id and r.get('id') == result_id:
                target = r
                break
            elif not result_id:
                target = r  # update the latest

        if not target:
            return jsonify({'success': False, 'error': 'Result not found'}), 404

        # Apply manual score updates
        questions = target.get('data', {}).get('questions', [])
        for upd in updates:
            qi = upd.get('question_index', 0)
            ci = upd.get('criterion_index', 0)
            manual_score = upd.get('manual_score')
            if manual_score is not None and qi < len(questions):
                criteria = questions[qi].get('criteria', [])
                if ci < len(criteria):
                    criteria[ci]['grade']['manualScore'] = float(manual_score)

        # Recalculate question totals using manual score where available
        total_score = 0
        max_total = 0
        for q in questions:
            q_total = 0
            q_max = 0
            for c in q.get('criteria', []):
                grade = c.get('grade', {})
                score = grade.get('manualScore') if grade.get('manualScore') is not None else grade.get('aiSuggestedScore', 0)
                q_total += score
                q_max += c.get('maxScore', 0)
            q['questionTotalScore'] = q_total
            q['questionMaxScore'] = q_max
            q['questionPercentage'] = round((q_total / q_max) * 100, 1) if q_max > 0 else 0
            total_score += q_total
            max_total += q_max

        # Update summary
        summary = target.get('data', {}).get('summary', {})
        summary['totalScore'] = total_score
        summary['maxScore'] = max_total
        summary['percentage'] = round((total_score / max_total) * 100, 1) if max_total > 0 else 0

        # Determine grade
        pct = summary['percentage']
        if pct >= 90: summary['grade'] = 'A+'
        elif pct >= 85: summary['grade'] = 'A'
        elif pct >= 80: summary['grade'] = 'A-'
        elif pct >= 75: summary['grade'] = 'B+'
        elif pct >= 70: summary['grade'] = 'B'
        elif pct >= 65: summary['grade'] = 'B-'
        elif pct >= 60: summary['grade'] = 'C+'
        elif pct >= 55: summary['grade'] = 'C'
        elif pct >= 50: summary['grade'] = 'C-'
        else: summary['grade'] = 'F'

        # Save back
        system.results_storage.save_grading_result(target)

        return jsonify({
            'success': True,
            'data': target,
            'message': 'Grading result updated successfully'
        })

    except Exception as e:
        logger.error(f"Error updating grading result: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/grading-statistics', methods=['GET'])
@async_route
async def get_grading_statistics():
    """
    Response:
    {
        "success": true,
        "data": {
            "total_results": 50,
            "unique_students": 25,
            "unique_assignments": 5,
            "average_score_percentage": 78.5,
            "date_range": {...}
        }
    }
    """
    if not GRADING_AVAILABLE:
        return jsonify({
            'success': False,
            'error': 'Grading system not available'
        }), 503
    
    try:
        system = await get_grading_system()
        stats = system.get_grading_statistics()
        
        return jsonify({
            'success': True,
            'data': stats,
            'message': 'Statistics retrieved successfully'
        })
        
    except Exception as e:
        logger.error(f"Error getting statistics: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/available-rubrics', methods=['GET'])
@async_route
async def get_available_rubrics():
    """
    Get list of available rubrics/marking schemes
    
    Response:
    {
        "success": true,
        "data": [
            {
                "id": "rubric-1",
                "title": "Essay Rubric",
                "description": "...",
                "created_at": "..."
            }
        ],
        "count": 5
    }
    """
    if not GRADING_AVAILABLE:
        return jsonify({
            'success': False,
            'error': 'Grading system not available'
        }), 503
    
    try:
        system = await get_grading_system()
        rubrics = system.get_available_rubrics()
        
        return jsonify({
            'success': True,
            'data': rubrics,
            'count': len(rubrics),
            'message': f'Found {len(rubrics)} available rubrics'
        })
        
    except Exception as e:
        logger.error(f"Error getting rubrics: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# ============================================================================
# LECTURE NOTES API ENDPOINTS
# ============================================================================

@app.route('/api/lecture-notes/upload', methods=['POST'])
@async_route
async def upload_lecture_note():
    """
    Upload a lecture note file with optional rubric association
    
    Form data:
    - file: The lecture note file (PDF, DOCX, TXT, MD up to 50MB)
    - associate_with_rubric: Optional rubric ID to associate with (optional)
    
    Response:
    {
        "success": true,
        "data": {
            "id": "note-uuid",
            "filename": "stored_filename",
            "original_name": "lecture_01.pdf",
            "file_size": 1024000,
            "file_type": "pdf",
            "uploaded_at": "2024-01-15T10:00:00Z",
            "processing_status": "completed",
            "word_count": 1500,
            "associated_rubrics": ["rubric-1"]
        },
        "message": "Lecture note uploaded successfully"
    }
    """
    if not LECTURE_NOTES_AVAILABLE:
        return jsonify({
            'success': False,
            'error': 'Lecture notes service not available'
        }), 503
    
    try:
        # Check if file is present
        if 'file' not in request.files:
            return jsonify({
                'success': False,
                'error': 'No file provided'
            }), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({
                'success': False,
                'error': 'No file selected'
            }), 400
        
        # Get optional rubric association
        associate_with_rubric = request.form.get('associate_with_rubric')
        
        # Read file content
        file_content = file.read()
        filename = file.filename
        
        # Get lecture notes service
        service = await get_lecture_notes_service()
        
        # Upload and process the file
        note = await service.upload_lecture_note(
            file_content=file_content,
            filename=filename,
            associate_with_rubric=associate_with_rubric
        )
        
        return jsonify({
            'success': True,
            'data': {
                'id': note.id,
                'filename': note.filename,
                'original_name': note.original_name,
                'file_size': note.file_size,
                'file_type': note.file_type,
                'uploaded_at': note.uploaded_at.isoformat(),
                'processed_at': note.processed_at.isoformat() if note.processed_at else None,
                'processing_status': note.processing_status.value,
                'word_count': note.word_count,
                'associated_rubrics': note.associated_rubrics,
                'metadata': note.metadata
            },
            'message': 'Lecture note uploaded successfully'
        })
        
    except Exception as e:
        logger.error(f"Error uploading lecture note: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/lecture-notes', methods=['GET'])
@async_route
async def get_lecture_notes():
    """
    Get all lecture notes with optional filtering
    
    Query parameters:
    - rubric_id: Filter by associated rubric ID (optional)
    
    Response:
    {
        "success": true,
        "data": [
            {
                "id": "note-uuid",
                "filename": "stored_filename",
                "original_name": "lecture_01.pdf",
                "file_size": 1024000,
                "file_type": "pdf",
                "uploaded_at": "2024-01-15T10:00:00Z",
                "processing_status": "completed",
                "word_count": 1500,
                "associated_rubrics": ["rubric-1"]
            }
        ],
        "count": 5,
        "message": "Found 5 lecture notes"
    }
    """
    if not LECTURE_NOTES_AVAILABLE:
        return jsonify({
            'success': False,
            'error': 'Lecture notes service not available'
        }), 503
    
    try:
        service = await get_lecture_notes_service()
        
        # Check for rubric filter
        rubric_id = request.args.get('rubric_id')
        
        if rubric_id:
            notes = service.get_notes_for_rubric(rubric_id)
            message = f'Found {len(notes)} notes for rubric {rubric_id}'
        else:
            notes = service.get_all_lecture_notes()
            message = f'Found {len(notes)} lecture notes'
        
        # Convert notes to response format
        notes_data = []
        for note in notes:
            notes_data.append({
                'id': note.id,
                'filename': note.filename,
                'original_name': note.original_name,
                'file_size': note.file_size,
                'file_type': note.file_type,
                'uploaded_at': note.uploaded_at.isoformat(),
                'processed_at': note.processed_at.isoformat() if note.processed_at else None,
                'processing_status': note.processing_status.value,
                'word_count': note.word_count,
                'associated_rubrics': note.associated_rubrics,
                'metadata': note.metadata
            })
        
        return jsonify({
            'success': True,
            'data': notes_data,
            'count': len(notes_data),
            'message': message
        })
        
    except Exception as e:
        logger.error(f"Error getting lecture notes: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/lecture-notes/<note_id>', methods=['DELETE'])
@async_route
async def delete_lecture_note(note_id):
    """
    Delete a lecture note by ID
    
    Response:
    {
        "success": true,
        "message": "Lecture note deleted successfully"
    }
    """
    if not LECTURE_NOTES_AVAILABLE:
        return jsonify({
            'success': False,
            'error': 'Lecture notes service not available'
        }), 503
    
    try:
        service = await get_lecture_notes_service()
        
        # Check if note exists
        note = service.get_lecture_note(note_id)
        if not note:
            return jsonify({
                'success': False,
                'error': 'Lecture note not found'
            }), 404
        
        # Delete the note
        success = await service.delete_lecture_note(note_id)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Lecture note deleted successfully'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to delete lecture note'
            }), 500
        
    except Exception as e:
        logger.error(f"Error deleting lecture note {note_id}: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/lecture-notes/<note_id>/associate', methods=['PUT'])
@async_route
async def associate_note_with_rubric(note_id):
    """
    Associate or disassociate a lecture note with rubrics
    
    Request body:
    {
        "rubric_ids": ["rubric-1", "rubric-2"],  // List of rubric IDs to associate
        "action": "associate"  // "associate" or "disassociate"
    }
    
    Response:
    {
        "success": true,
        "data": {
            "note_id": "note-uuid",
            "associated_rubrics": ["rubric-1", "rubric-2"]
        },
        "message": "Associations updated successfully"
    }
    """
    if not LECTURE_NOTES_AVAILABLE:
        return jsonify({
            'success': False,
            'error': 'Lecture notes service not available'
        }), 503
    
    try:
        # Validate request
        if not request.is_json:
            return jsonify({
                'success': False,
                'error': 'Request must be JSON'
            }), 400
        
        data = request.get_json()
        
        # Validate required fields
        if 'rubric_ids' not in data or 'action' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing required fields: rubric_ids, action'
            }), 400
        
        rubric_ids = data['rubric_ids']
        action = data['action']
        
        if action not in ['associate', 'disassociate']:
            return jsonify({
                'success': False,
                'error': 'Action must be "associate" or "disassociate"'
            }), 400
        
        if not isinstance(rubric_ids, list):
            return jsonify({
                'success': False,
                'error': 'rubric_ids must be a list'
            }), 400
        
        service = await get_lecture_notes_service()
        
        # Check if note exists
        note = service.get_lecture_note(note_id)
        if not note:
            return jsonify({
                'success': False,
                'error': 'Lecture note not found'
            }), 404
        
        # Process associations/disassociations
        success_count = 0
        failed_rubrics = []
        
        for rubric_id in rubric_ids:
            try:
                if action == 'associate':
                    success = await service.associate_note_with_rubric(note_id, rubric_id)
                else:  # disassociate
                    success = await service.disassociate_note_from_rubric(note_id, rubric_id)
                
                if success:
                    success_count += 1
                else:
                    failed_rubrics.append(rubric_id)
            except Exception as e:
                logger.error(f"Failed to {action} note {note_id} with rubric {rubric_id}: {e}")
                failed_rubrics.append(rubric_id)
        
        # Get updated note
        updated_note = service.get_lecture_note(note_id)
        
        response_data = {
            'note_id': note_id,
            'associated_rubrics': updated_note.associated_rubrics if updated_note else [],
            'success_count': success_count,
            'failed_count': len(failed_rubrics)
        }
        
        if failed_rubrics:
            response_data['failed_rubrics'] = failed_rubrics
        
        message = f'Successfully {action}d {success_count} rubric(s)'
        if failed_rubrics:
            message += f', failed {len(failed_rubrics)} rubric(s)'
        
        return jsonify({
            'success': True,
            'data': response_data,
            'message': message
        })
        
    except Exception as e:
        logger.error(f"Error updating associations for note {note_id}: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/lecture-notes/search', methods=['POST'])
@async_route
async def search_lecture_notes():
    """
    Search lecture notes by content
    
    Request body:
    {
        "query": "search term",
        "rubric_id": "rubric-1"  // Optional filter by rubric
    }
    
    Response:
    {
        "success": true,
        "data": [
            {
                "id": "note-uuid",
                "original_name": "lecture_01.pdf",
                "file_type": "pdf",
                "word_count": 1500,
                "associated_rubrics": ["rubric-1"],
                "match_preview": "...highlighted text..."
            }
        ],
        "count": 3,
        "query": "search term",
        "message": "Found 3 matching notes"
    }
    """
    if not LECTURE_NOTES_AVAILABLE:
        return jsonify({
            'success': False,
            'error': 'Lecture notes service not available'
        }), 503
    
    try:
        # Validate request
        if not request.is_json:
            return jsonify({
                'success': False,
                'error': 'Request must be JSON'
            }), 400
        
        data = request.get_json()
        
        # Validate required fields
        if 'query' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing required field: query'
            }), 400
        
        query = data['query'].strip()
        if not query:
            return jsonify({
                'success': False,
                'error': 'Query cannot be empty'
            }), 400
        
        rubric_id = data.get('rubric_id')
        
        service = await get_lecture_notes_service()
        
        # Search notes
        matching_notes = service.search_notes(query, rubric_id)
        
        # Convert to response format with match previews
        notes_data = []
        for note in matching_notes:
            # Create match preview (simple implementation)
            match_preview = ""
            if note.extracted_content:
                query_lower = query.lower()
                content_lower = note.extracted_content.lower()
                
                # Find first occurrence
                match_index = content_lower.find(query_lower)
                if match_index != -1:
                    # Extract context around match (100 chars before and after)
                    start = max(0, match_index - 100)
                    end = min(len(note.extracted_content), match_index + len(query) + 100)
                    match_preview = note.extracted_content[start:end]
                    
                    # Add ellipsis if truncated
                    if start > 0:
                        match_preview = "..." + match_preview
                    if end < len(note.extracted_content):
                        match_preview = match_preview + "..."
            
            notes_data.append({
                'id': note.id,
                'filename': note.filename,
                'original_name': note.original_name,
                'file_size': note.file_size,
                'file_type': note.file_type,
                'uploaded_at': note.uploaded_at.isoformat(),
                'processed_at': note.processed_at.isoformat() if note.processed_at else None,
                'processing_status': note.processing_status.value,
                'word_count': note.word_count,
                'associated_rubrics': note.associated_rubrics,
                'match_preview': match_preview
            })
        
        message = f'Found {len(notes_data)} matching notes'
        if rubric_id:
            message += f' for rubric {rubric_id}'
        
        return jsonify({
            'success': True,
            'data': notes_data,
            'count': len(notes_data),
            'query': query,
            'rubric_filter': rubric_id,
            'message': message
        })
        
    except Exception as e:
        logger.error(f"Error searching lecture notes: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/lecture-notes/rubric/<rubric_id>', methods=['GET'])
@async_route
async def get_notes_for_rubric(rubric_id):
    """
    Get all lecture notes associated with a specific rubric
    
    Response:
    {
        "success": true,
        "data": [
            {
                "id": "note-uuid",
                "original_name": "lecture_01.pdf",
                "file_type": "pdf",
                "word_count": 1500,
                "processing_status": "completed"
            }
        ],
        "count": 2,
        "rubric_id": "rubric-1",
        "message": "Found 2 notes for rubric rubric-1"
    }
    """
    if not LECTURE_NOTES_AVAILABLE:
        return jsonify({
            'success': False,
            'error': 'Lecture notes service not available'
        }), 503
    
    try:
        service = await get_lecture_notes_service()
        
        # Get notes for rubric
        notes = service.get_notes_for_rubric(rubric_id)
        
        # Convert to response format
        notes_data = []
        for note in notes:
            notes_data.append({
                'id': note.id,
                'filename': note.filename,
                'original_name': note.original_name,
                'file_size': note.file_size,
                'file_type': note.file_type,
                'uploaded_at': note.uploaded_at.isoformat(),
                'processed_at': note.processed_at.isoformat() if note.processed_at else None,
                'processing_status': note.processing_status.value,
                'word_count': note.word_count,
                'associated_rubrics': note.associated_rubrics,
                'metadata': note.metadata
            })
        
        return jsonify({
            'success': True,
            'data': notes_data,
            'count': len(notes_data),
            'rubric_id': rubric_id,
            'message': f'Found {len(notes_data)} notes for rubric {rubric_id}'
        })
        
    except Exception as e:
        logger.error(f"Error getting notes for rubric {rubric_id}: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/lecture-notes/<note_id>/preview', methods=['GET'])
@async_route
async def get_note_preview(note_id):
    """
    Get content preview and metadata for a specific lecture note
    
    Query parameters:
    - max_length: Maximum length of content preview (default: 1000)
    
    Response:
    {
        "success": true,
        "data": {
            "id": "note-uuid",
            "original_name": "lecture_01.pdf",
            "file_type": "pdf",
            "file_size": 1024000,
            "word_count": 1500,
            "processing_status": "completed",
            "content_preview": "First 1000 characters of content...",
            "full_content_available": true,
            "associated_rubrics": ["rubric-1"],
            "metadata": {...}
        },
        "message": "Note preview retrieved successfully"
    }
    """
    if not LECTURE_NOTES_AVAILABLE:
        return jsonify({
            'success': False,
            'error': 'Lecture notes service not available'
        }), 503
    
    try:
        service = await get_lecture_notes_service()
        
        # Get the note
        note = service.get_lecture_note(note_id)
        if not note:
            return jsonify({
                'success': False,
                'error': 'Lecture note not found'
            }), 404
        
        # Get max length parameter
        max_length = int(request.args.get('max_length', 1000))
        max_length = min(max_length, 10000)  # Cap at 10k characters
        
        # Create content preview
        content_preview = ""
        full_content_available = False
        
        if note.extracted_content:
            full_content_available = True
            if len(note.extracted_content) <= max_length:
                content_preview = note.extracted_content
            else:
                content_preview = note.extracted_content[:max_length] + "..."
        
        return jsonify({
            'success': True,
            'data': {
                'id': note.id,
                'filename': note.filename,
                'original_name': note.original_name,
                'file_size': note.file_size,
                'file_type': note.file_type,
                'uploaded_at': note.uploaded_at.isoformat(),
                'processed_at': note.processed_at.isoformat() if note.processed_at else None,
                'processing_status': note.processing_status.value,
                'word_count': note.word_count,
                'content_preview': content_preview,
                'full_content_available': full_content_available,
                'content_length': len(note.extracted_content) if note.extracted_content else 0,
                'preview_length': len(content_preview),
                'associated_rubrics': note.associated_rubrics,
                'metadata': note.metadata
            },
            'message': 'Note preview retrieved successfully'
        })
        
    except Exception as e:
        logger.error(f"Error getting note preview {note_id}: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/lecture-notes/statistics', methods=['GET'])
@async_route
async def get_lecture_notes_statistics():
    """
    Get statistics about lecture notes
    
    Response:
    {
        "success": true,
        "data": {
            "total_notes": 10,
            "total_size_mb": 25.5,
            "file_types": {"pdf": 5, "docx": 3, "txt": 2},
            "processing_status": {"completed": 8, "failed": 1, "pending": 1},
            "total_associations": 15,
            "unique_rubrics": 3
        },
        "message": "Statistics retrieved successfully"
    }
    """
    if not LECTURE_NOTES_AVAILABLE:
        return jsonify({
            'success': False,
            'error': 'Lecture notes service not available'
        }), 503
    
    try:
        service = await get_lecture_notes_service()
        
        # Get statistics from service
        stats = service.get_processing_statistics()
        
        return jsonify({
            'success': True,
            'data': stats,
            'message': 'Statistics retrieved successfully'
        })
        
    except Exception as e:
        logger.error(f"Error getting lecture notes statistics: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# ─── Rubrics persistence endpoint ────────────────────────────────────────────

RUBRICS_FILE = os.path.join(os.path.dirname(__file__), 'src', 'data', 'rubrics.json')

@app.route('/rubrics', methods=['POST', 'OPTIONS'])
def save_rubrics():
    if request.method == 'OPTIONS':
        response = app.make_default_options_response()
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
        return response
    try:
        rubrics = request.get_json()
        if rubrics is None:
            return jsonify({'success': False, 'error': 'No data provided'}), 400
        os.makedirs(os.path.dirname(RUBRICS_FILE), exist_ok=True)
        with open(RUBRICS_FILE, 'w', encoding='utf-8') as f:
            json.dump(rubrics, f, indent=2, ensure_ascii=False)
        return jsonify({'success': True, 'message': f'Saved {len(rubrics)} rubrics'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


if __name__ == '__main__':
    print("=" * 60)
    print("Grading API Server (All Exam Types)")
    print("=" * 60)
    print(f"Grading System Available: {GRADING_AVAILABLE}")
    print(f"Lecture Notes Available: {LECTURE_NOTES_AVAILABLE}")
    print("\nAvailable Endpoints:")
    print("  GET  /health                    - Health check")
    print("  POST /grade-answer              - Grade an answer (all exam types)")
    print("  POST /grade-essay               - Grade essay (backward compatibility)")
    print("  GET  /grading-results/<id>      - Get student results")
    print("  GET  /grading-results           - Get all results (with filters)")
    print("  GET  /grading-statistics        - Get grading statistics")
    print("  GET  /available-rubrics         - Get available rubrics")
    
    if LECTURE_NOTES_AVAILABLE:
        print("\nLecture Notes Endpoints:")
        print("  POST /api/lecture-notes/upload           - Upload lecture note")
        print("  GET  /api/lecture-notes                  - List all lecture notes")
        print("  DELETE /api/lecture-notes/<id>           - Delete lecture note")
        print("  PUT  /api/lecture-notes/<id>/associate   - Associate with rubrics")
        print("  POST /api/lecture-notes/search           - Search lecture notes")
        print("  GET  /api/lecture-notes/rubric/<id>      - Get notes for rubric")
        print("  GET  /api/lecture-notes/<id>/preview     - Get note preview")
        print("  GET  /api/lecture-notes/statistics       - Get statistics")
    
    print("\nStarting server on http://localhost:5000")
    print("=" * 60)
    
    app.run(debug=False, host='0.0.0.0', port=5000)
