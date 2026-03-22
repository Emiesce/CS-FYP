"""
Lecture Notes File Storage API
Handles file upload, download, and deletion for lecture notes
"""

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import uuid
from pathlib import Path
from werkzeug.utils import secure_filename
import mimetypes

app = Flask(__name__)
CORS(app)

# Configuration
UPLOAD_FOLDER = Path('uploads/lecture-notes')
ALLOWED_EXTENSIONS = {'pdf', 'docx', 'txt', 'md', 'doc'}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB

# Ensure upload directory exists
UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)

def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_file_path(note_id):
    """Get the file path for a given note ID"""
    # Find file with matching note_id prefix
    for file in UPLOAD_FOLDER.glob(f"{note_id}_*"):
        return file
    return None

@app.route('/api/lecture-notes/upload', methods=['POST'])
def upload_file():
    """
    Upload a lecture note file
    
    Request:
        - file: The file to upload (multipart/form-data)
        - noteId: Unique identifier for the note
        
    Response:
        {
            "success": true,
            "noteId": "note-123456",
            "filename": "lecture.pdf",
            "fileSize": 1024000,
            "message": "File uploaded successfully"
        }
    """
    try:
        # Check if file is in request
        if 'file' not in request.files:
            return jsonify({
                'success': False,
                'message': 'No file provided'
            }), 400
        
        file = request.files['file']
        note_id = request.form.get('noteId')
        
        if not note_id:
            return jsonify({
                'success': False,
                'message': 'Note ID is required'
            }), 400
        
        # Check if file is selected
        if file.filename == '':
            return jsonify({
                'success': False,
                'message': 'No file selected'
            }), 400
        
        # Validate file extension
        if not allowed_file(file.filename):
            return jsonify({
                'success': False,
                'message': f'File type not allowed. Allowed types: {", ".join(ALLOWED_EXTENSIONS)}'
            }), 400
        
        # Secure the filename
        original_filename = secure_filename(file.filename)
        
        # Create unique filename with note_id prefix
        file_extension = original_filename.rsplit('.', 1)[1].lower()
        stored_filename = f"{note_id}_{original_filename}"
        file_path = UPLOAD_FOLDER / stored_filename
        
        # Check file size
        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)
        
        if file_size > MAX_FILE_SIZE:
            return jsonify({
                'success': False,
                'message': f'File too large. Maximum size is {MAX_FILE_SIZE / (1024*1024)}MB'
            }), 400
        
        # Save file
        file.save(str(file_path))
        
        return jsonify({
            'success': True,
            'noteId': note_id,
            'filename': original_filename,
            'storedFilename': stored_filename,
            'fileSize': file_size,
            'message': 'File uploaded successfully'
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Upload failed: {str(e)}'
        }), 500

@app.route('/api/lecture-notes/download/<note_id>', methods=['GET'])
def download_file(note_id):
    """
    Download a lecture note file
    
    Parameters:
        - note_id: The unique identifier for the note
        
    Response:
        - File download or error message
    """
    try:
        file_path = get_file_path(note_id)
        
        if not file_path or not file_path.exists():
            return jsonify({
                'success': False,
                'message': 'File not found'
            }), 404
        
        # Get original filename (remove note_id prefix)
        stored_filename = file_path.name
        original_filename = '_'.join(stored_filename.split('_')[1:])
        
        # Determine mimetype
        mimetype = mimetypes.guess_type(str(file_path))[0] or 'application/octet-stream'
        
        return send_file(
            file_path,
            mimetype=mimetype,
            as_attachment=True,
            download_name=original_filename
        )
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Download failed: {str(e)}'
        }), 500

@app.route('/api/lecture-notes/view/<note_id>', methods=['GET'])
def view_file(note_id):
    """
    View a lecture note file (inline, not as download)
    
    Parameters:
        - note_id: The unique identifier for the note
        
    Response:
        - File content for viewing or error message
    """
    try:
        file_path = get_file_path(note_id)
        
        if not file_path or not file_path.exists():
            return jsonify({
                'success': False,
                'message': 'File not found'
            }), 404
        
        # Determine mimetype
        mimetype = mimetypes.guess_type(str(file_path))[0] or 'application/octet-stream'
        
        return send_file(
            file_path,
            mimetype=mimetype,
            as_attachment=False  # Display inline
        )
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'View failed: {str(e)}'
        }), 500

@app.route('/api/lecture-notes/delete/<note_id>', methods=['DELETE'])
def delete_file(note_id):
    """
    Delete a lecture note file
    
    Parameters:
        - note_id: The unique identifier for the note
        
    Response:
        {
            "success": true,
            "message": "File deleted successfully"
        }
    """
    try:
        file_path = get_file_path(note_id)
        
        if not file_path or not file_path.exists():
            return jsonify({
                'success': False,
                'message': 'File not found'
            }), 404
        
        # Delete the file
        file_path.unlink()
        
        return jsonify({
            'success': True,
            'message': 'File deleted successfully'
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Delete failed: {str(e)}'
        }), 500

@app.route('/api/lecture-notes/exists/<note_id>', methods=['GET'])
def check_file_exists(note_id):
    """
    Check if a lecture note file exists
    
    Parameters:
        - note_id: The unique identifier for the note
        
    Response:
        {
            "exists": true,
            "noteId": "note-123456",
            "filename": "lecture.pdf",
            "fileSize": 1024000
        }
    """
    try:
        file_path = get_file_path(note_id)
        
        if not file_path or not file_path.exists():
            return jsonify({
                'exists': False,
                'noteId': note_id
            }), 200
        
        # Get file info
        stored_filename = file_path.name
        original_filename = '_'.join(stored_filename.split('_')[1:])
        file_size = file_path.stat().st_size
        
        return jsonify({
            'exists': True,
            'noteId': note_id,
            'filename': original_filename,
            'fileSize': file_size
        }), 200
        
    except Exception as e:
        return jsonify({
            'exists': False,
            'noteId': note_id,
            'error': str(e)
        }), 500

@app.route('/api/lecture-notes/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'lecture-notes-file-api',
        'uploadFolder': str(UPLOAD_FOLDER),
        'maxFileSize': f'{MAX_FILE_SIZE / (1024*1024)}MB'
    }), 200

if __name__ == '__main__':
    print(f"Starting Lecture Notes File API...")
    print(f"Upload folder: {UPLOAD_FOLDER.absolute()}")
    print(f"Max file size: {MAX_FILE_SIZE / (1024*1024)}MB")
    print(f"Allowed extensions: {', '.join(ALLOWED_EXTENSIONS)}")
    app.run(host='0.0.0.0', port=5001, debug=True)
