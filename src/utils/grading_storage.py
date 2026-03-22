"""
Utility module for storing and retrieving grading results.
Provides JSON-based temporary storage before database persistence.
"""

import json
import os
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)


class GradingResultsStorage:
    """Manages temporary JSON storage for grading results."""
    
    def __init__(self, storage_path: Optional[str] = None):
        """
        Initialize grading results storage.
        
        Args:
            storage_path: Path to JSON storage file (defaults to src/data/grading_results.json)
        """
        if storage_path:
            self.storage_path = storage_path
        else:
            # Default path relative to this file
            current_dir = Path(__file__).parent
            self.storage_path = str(current_dir.parent / "data" / "grading_results.json")
        
        # Ensure the storage file exists
        self._ensure_storage_file()
    
    def _ensure_storage_file(self) -> None:
        """Ensure the storage file exists, create if it doesn't."""
        try:
            if not os.path.exists(self.storage_path):
                os.makedirs(os.path.dirname(self.storage_path), exist_ok=True)
                with open(self.storage_path, 'w', encoding='utf-8') as f:
                    json.dump([], f)
                logger.info(f"Created grading results storage file at {self.storage_path}")
        except Exception as e:
            logger.error(f"Failed to ensure storage file exists: {e}")
            raise
    
    def save_grading_result(self, result: Dict[str, Any]) -> str:
        """
        Save a single grading result to JSON storage.
        
        Args:
            result: Grading result dictionary
            
        Returns:
            Result ID
        """
        try:
            # Generate unique ID if not present
            if 'id' not in result:
                result['id'] = f"grade_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{result.get('student_id', 'unknown')}"
            
            # Add timestamp if not present
            if 'saved_at' not in result:
                result['saved_at'] = datetime.now().isoformat()
            
            # Load existing results
            results = self.load_all_results()
            
            # Check if result already exists (update if it does)
            existing_index = None
            for i, existing_result in enumerate(results):
                if existing_result.get('id') == result['id']:
                    existing_index = i
                    break
            
            if existing_index is not None:
                results[existing_index] = result
                logger.info(f"Updated existing grading result: {result['id']}")
            else:
                results.append(result)
                logger.info(f"Saved new grading result: {result['id']}")
            
            # Save back to file
            self._write_results(results)
            
            return result['id']
            
        except Exception as e:
            logger.error(f"Failed to save grading result: {e}")
            raise
    
    def load_all_results(self) -> List[Dict[str, Any]]:
        """
        Load all grading results from JSON storage.
        
        Returns:
            List of grading result dictionaries
        """
        try:
            if not os.path.exists(self.storage_path):
                return []
            
            with open(self.storage_path, 'r', encoding='utf-8') as f:
                results = json.load(f)
            
            logger.debug(f"Loaded {len(results)} grading results from storage")
            return results
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse grading results JSON: {e}")
            return []
        except Exception as e:
            logger.error(f"Failed to load grading results: {e}")
            return []
    
    def get_result_by_id(self, result_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a specific grading result by ID.
        
        Args:
            result_id: Result identifier
            
        Returns:
            Grading result dictionary or None if not found
        """
        results = self.load_all_results()
        for result in results:
            if result.get('id') == result_id:
                return result
        return None
    
    def get_results_by_student(self, student_id: str) -> List[Dict[str, Any]]:
        """
        Get all grading results for a specific student.
        
        Args:
            student_id: Student identifier
            
        Returns:
            List of grading results for the student
        """
        results = self.load_all_results()
        return [r for r in results if r.get('data', {}).get('studentID') == student_id]
    
    def get_results_by_assignment(self, assignment_id: str) -> List[Dict[str, Any]]:
        """
        Get all grading results for a specific assignment.
        
        Args:
            assignment_id: Assignment identifier
            
        Returns:
            List of grading results for the assignment
        """
        results = self.load_all_results()
        return [r for r in results if r.get('data', {}).get('examId') == assignment_id or r.get('_metadata', {}).get('assignment_id') == assignment_id]
    
    def get_results_by_marking_scheme(self, marking_scheme_id: str) -> List[Dict[str, Any]]:
        """
        Get all grading results for a specific marking scheme.
        
        Args:
            marking_scheme_id: Marking scheme identifier
            
        Returns:
            List of grading results using the marking scheme
        """
        results = self.load_all_results()
        return [r for r in results if r.get('_metadata', {}).get('marking_scheme_id') == marking_scheme_id]
    
    def delete_result(self, result_id: str) -> bool:
        """
        Delete a grading result by ID.
        
        Args:
            result_id: Result identifier
            
        Returns:
            True if deleted, False if not found
        """
        try:
            results = self.load_all_results()
            initial_count = len(results)
            
            results = [r for r in results if r.get('id') != result_id]
            
            if len(results) < initial_count:
                self._write_results(results)
                logger.info(f"Deleted grading result: {result_id}")
                return True
            else:
                logger.warning(f"Grading result not found: {result_id}")
                return False
                
        except Exception as e:
            logger.error(f"Failed to delete grading result: {e}")
            return False
    
    def clear_all_results(self) -> int:
        """
        Clear all grading results from storage.
        
        Returns:
            Number of results cleared
        """
        try:
            results = self.load_all_results()
            count = len(results)
            
            self._write_results([])
            logger.info(f"Cleared {count} grading results from storage")
            
            return count
            
        except Exception as e:
            logger.error(f"Failed to clear grading results: {e}")
            return 0
    
    def get_statistics(self) -> Dict[str, Any]:
        """
        Get statistics about stored grading results.
        
        Returns:
            Dictionary with statistics
        """
        try:
            results = self.load_all_results()
            
            if not results:
                return {
                    "total_results": 0,
                    "unique_students": 0,
                    "unique_assignments": 0,
                    "average_score": 0,
                    "date_range": None
                }
            
            # Calculate statistics
            unique_students = len(set(r.get('data', {}).get('studentID') for r in results if r.get('data', {}).get('studentID')))
            unique_assignments = len(set(r.get('data', {}).get('examId') for r in results if r.get('data', {}).get('examId')))
            
            # Calculate average score
            scores = []
            for result in results:
                data = result.get('data', {})
                summary = data.get('summary', {})
                if 'percentage' in summary:
                    scores.append(summary['percentage'])
                elif 'totalScore' in summary and 'maxScore' in summary:
                    if summary['maxScore'] > 0:
                        percentage = (summary['totalScore'] / summary['maxScore']) * 100
                        scores.append(percentage)
            
            average_score = sum(scores) / len(scores) if scores else 0
            
            # Get date range
            dates = [r.get('data', {}).get('gradedAt') or r.get('_metadata', {}).get('stored_at') for r in results if r.get('data', {}).get('gradedAt') or r.get('_metadata', {}).get('stored_at')]
            date_range = None
            if dates:
                dates.sort()
                date_range = {
                    "earliest": dates[0],
                    "latest": dates[-1]
                }
            
            return {
                "total_results": len(results),
                "unique_students": unique_students,
                "unique_assignments": unique_assignments,
                "average_score_percentage": round(average_score, 2),
                "date_range": date_range
            }
            
        except Exception as e:
            logger.error(f"Failed to calculate statistics: {e}")
            return {"error": str(e)}
    
    def _write_results(self, results: List[Dict[str, Any]]) -> None:
        """
        Write results to JSON file.
        
        Args:
            results: List of result dictionaries
        """
        try:
            with open(self.storage_path, 'w', encoding='utf-8') as f:
                json.dump(results, f, indent=2, ensure_ascii=False)
            logger.debug(f"Wrote {len(results)} results to storage")
        except Exception as e:
            logger.error(f"Failed to write results to file: {e}")
            raise
    
    def export_to_csv(self, output_path: str) -> bool:
        """
        Export grading results to CSV format.
        
        Args:
            output_path: Path for CSV output file
            
        Returns:
            True if successful, False otherwise
        """
        try:
            import csv
            
            results = self.load_all_results()
            if not results:
                logger.warning("No results to export")
                return False
            
            # Determine CSV columns from first result
            fieldnames = ['id', 'student_id', 'assignment_id', 'marking_scheme_id', 
                         'total_score', 'max_total_score', 'processed_at', 'saved_at']
            
            with open(output_path, 'w', newline='', encoding='utf-8') as csvfile:
                writer = csv.DictWriter(csvfile, fieldnames=fieldnames, extrasaction='ignore')
                writer.writeheader()
                
                for result in results:
                    writer.writerow(result)
            
            logger.info(f"Exported {len(results)} results to {output_path}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to export to CSV: {e}")
            return False


def convert_grading_response_to_exam_format(
    response: Any, 
    student_info: Dict[str, Any],
    exam_info: Dict[str, Any],
    grader_id: str = "ai_system"
) -> Dict[str, Any]:
    """
    Convert EssayGradingResponse object to comprehensive exam format for storage.
    
    Args:
        response: EssayGradingResponse object
        student_info: Dictionary with student information (studentID, studentName)
        exam_info: Dictionary with exam information (examId, examTitle, courseId, submittedAt)
        grader_id: ID of the grader (default: "ai_system")
        
    Returns:
        Dictionary in comprehensive exam format
    """
    try:
        current_time = datetime.now().isoformat() + "Z"
        
        # Convert response to dict — use model_dump with mode='python' to keep nested objects as dicts
        if hasattr(response, 'model_dump'):
            response_dict = response.model_dump()
        elif hasattr(response, 'dict'):
            response_dict = response.dict()
        else:
            response_dict = {
                'student_id': response.student_id,
                'total_score': response.total_score,
                'max_total_score': response.max_total_score,
                'overall_feedback': getattr(response, 'overall_feedback', ''),
                'processed_at': getattr(response, 'processed_at', current_time),
                'results': response.results if hasattr(response, 'results') else []
            }
        
        # Build questions array
        questions = []
        question_number = 1
        
        # Get results — handle both pydantic objects and dicts
        raw_results = response_dict.get('results', [])
        
        for criterion in raw_results:
            # Serialize pydantic objects to dict if needed
            if hasattr(criterion, 'model_dump'):
                crit_dict = criterion.model_dump()
            elif hasattr(criterion, 'dict'):
                crit_dict = criterion.dict()
            elif isinstance(criterion, dict):
                crit_dict = criterion
            else:
                crit_dict = {
                    'criterion_id': getattr(criterion, 'criterion_id', ''),
                    'criterion_name': getattr(criterion, 'criterion_name', ''),
                    'score': getattr(criterion, 'score', 0),
                    'max_score': getattr(criterion, 'max_score', 0),
                    'matched_level': getattr(criterion, 'matched_level', ''),
                    'justification': getattr(criterion, 'justification', ''),
                    'suggestion_for_improvement': getattr(criterion, 'suggestion_for_improvement', ''),
                    'highlighted_text': getattr(criterion, 'highlighted_text', '')
                }
            
            question = {
                "questionId": crit_dict.get('criterion_id', f"q{question_number}"),
                "questionNumber": question_number,
                "questionText": crit_dict.get('criterion_name', f"Question {question_number}"),
                "questionType": "essay",
                "topicId": "general",
                "studentAnswer": {
                    "id": f"answer{question_number}",
                    "answerText": exam_info.get('answerText', ''),
                    "submittedAt": exam_info.get('submittedAt', current_time),
                    "wordCount": len(exam_info.get('answerText', '').split()) if exam_info.get('answerText') else 0
                },
                "criteria": [
                    {
                        "criterionId": crit_dict.get('criterion_id', f"crit{question_number}"),
                        "criterionName": crit_dict.get('criterion_name', 'Content'),
                        "description": "AI-generated assessment criteria",
                        "maxScore": crit_dict.get('max_score', 10),
                        "weight": 1.0,
                        "grade": {
                            "manualScore": None,  # No manual score initially
                            "aiSuggestedScore": crit_dict.get('score', 0),
                            "highlightedText": crit_dict.get('highlighted_text', ''),
                            "aiJustification": crit_dict.get('justification', ''),
                            "aiSuggestion": crit_dict.get('suggestion_for_improvement', ''),
                            "gradedBy": grader_id,
                            "gradedAt": current_time
                        }
                    }
                ],
                "questionTotalScore": crit_dict.get('score', 0),
                "questionMaxScore": crit_dict.get('max_score', 10),
                "questionPercentage": round((crit_dict.get('score', 0) / crit_dict.get('max_score', 1)) * 100, 1) if crit_dict.get('max_score', 0) > 0 else 0
            }
            
            questions.append(question)
            question_number += 1
        
        # Calculate summary
        total_score = response_dict.get('total_score', 0)
        max_score = response_dict.get('max_total_score', 1)
        percentage = round((total_score / max_score) * 100, 1) if max_score > 0 else 0
        
        # Determine letter grade
        if percentage >= 90:
            letter_grade = "A+"
        elif percentage >= 85:
            letter_grade = "A"
        elif percentage >= 80:
            letter_grade = "A-"
        elif percentage >= 75:
            letter_grade = "B+"
        elif percentage >= 70:
            letter_grade = "B"
        elif percentage >= 65:
            letter_grade = "B-"
        elif percentage >= 60:
            letter_grade = "C+"
        elif percentage >= 55:
            letter_grade = "C"
        elif percentage >= 50:
            letter_grade = "C-"
        else:
            letter_grade = "F"
        
        # Build the complete exam result structure
        exam_result = {
            "data": {
                "studentID": student_info.get('studentID', response_dict.get('student_id', 'unknown')),
                "studentName": student_info.get('studentName', 'Unknown Student'),
                "examId": exam_info.get('examId', 'exam_' + datetime.now().strftime('%Y%m%d')),
                "examTitle": exam_info.get('examTitle', 'AI Graded Assessment'),
                "courseId": exam_info.get('courseId', 'COURSE001'),
                "submittedAt": exam_info.get('submittedAt', current_time),
                "gradedAt": current_time,
                "status": "graded",
                "questions": questions,
                "summary": {
                    "totalScore": total_score,
                    "maxScore": max_score,
                    "percentage": percentage,
                    "grade": letter_grade,
                    "totalQuestions": len(questions),
                    "gradedQuestions": len(questions),
                    "pendingQuestions": 0
                }
            },
            "success": True,
            "message": "Exam results processed successfully"
        }
        
        return exam_result
        
    except Exception as e:
        logger.error(f"Failed to convert grading response to exam format: {e}")
        raise


def convert_grading_response_to_dict(response: Any) -> Dict[str, Any]:
    """
    Legacy function for backward compatibility.
    Convert EssayGradingResponse object to simple dictionary format.
    
    Args:
        response: EssayGradingResponse object
        
    Returns:
        Dictionary representation
    """
    # Use the new exam format with default values
    student_info = {
        'studentID': getattr(response, 'student_id', 'unknown'),
        'studentName': 'Unknown Student'
    }
    exam_info = {
        'examId': 'legacy_exam',
        'examTitle': 'Legacy Assessment',
        'courseId': 'LEGACY001',
        'submittedAt': datetime.now().isoformat() + "Z"
    }
    
    return convert_grading_response_to_exam_format(response, student_info, exam_info)


# Create a global instance for easy access
_default_storage = None

def get_default_storage() -> GradingResultsStorage:
    """Get the default grading results storage instance."""
    global _default_storage
    if _default_storage is None:
        _default_storage = GradingResultsStorage()
    return _default_storage
