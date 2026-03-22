"""
Storage utility for lecture notes and background materials.
Provides JSON-based persistence for lecture notes with rubric associations.
Includes comprehensive validation and data integrity checks.
"""

import json
import os
import logging
from typing import List, Dict, Any, Optional, Set, Tuple
from datetime import datetime
from pathlib import Path
from uuid import uuid4

from src.models.grading_models import LectureNote, LectureNotesStore, ProcessingStatus
from src.errors.grading_errors import ValidationError, IntegrationError

logger = logging.getLogger(__name__)


class AssociationValidator:
    """Validator for rubric-note associations and data integrity."""
    
    @staticmethod
    def validate_note_exists(note_id: str, store: LectureNotesStore) -> Tuple[bool, Optional[str]]:
        """
        Validate that a note exists in the store.
        
        Args:
            note_id: Note identifier
            store: LectureNotesStore instance
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        if not note_id:
            return False, "Note ID cannot be empty"
        
        if note_id not in store.notes:
            return False, f"Note '{note_id}' does not exist"
        
        return True, None
    
    @staticmethod
    def validate_rubric_id(rubric_id: str) -> Tuple[bool, Optional[str]]:
        """
        Validate rubric ID format.
        
        Args:
            rubric_id: Rubric identifier
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        if not rubric_id:
            return False, "Rubric ID cannot be empty"
        
        if not isinstance(rubric_id, str):
            return False, f"Rubric ID must be a string, got {type(rubric_id)}"
        
        if len(rubric_id) > 255:
            return False, "Rubric ID exceeds maximum length of 255 characters"
        
        # Check for invalid characters
        invalid_chars = ['\0', '\n', '\r', '\t']
        if any(char in rubric_id for char in invalid_chars):
            return False, "Rubric ID contains invalid characters"
        
        return True, None
    
    @staticmethod
    def validate_association(note_id: str, rubric_id: str, store: LectureNotesStore) -> Tuple[bool, Optional[str]]:
        """
        Validate a rubric-note association before creation.
        
        Args:
            note_id: Note identifier
            rubric_id: Rubric identifier
            store: LectureNotesStore instance
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        # Validate note exists
        note_valid, note_error = AssociationValidator.validate_note_exists(note_id, store)
        if not note_valid:
            return False, note_error
        
        # Validate rubric ID format
        rubric_valid, rubric_error = AssociationValidator.validate_rubric_id(rubric_id)
        if not rubric_valid:
            return False, rubric_error
        
        # Check if association already exists
        note = store.notes[note_id]
        if rubric_id in note.associated_rubrics:
            return False, f"Note '{note_id}' is already associated with rubric '{rubric_id}'"
        
        return True, None
    
    @staticmethod
    def validate_disassociation(note_id: str, rubric_id: str, store: LectureNotesStore) -> Tuple[bool, Optional[str]]:
        """
        Validate a rubric-note disassociation before removal.
        
        Args:
            note_id: Note identifier
            rubric_id: Rubric identifier
            store: LectureNotesStore instance
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        # Validate note exists
        note_valid, note_error = AssociationValidator.validate_note_exists(note_id, store)
        if not note_valid:
            return False, note_error
        
        # Check if association exists
        note = store.notes[note_id]
        if rubric_id not in note.associated_rubrics:
            return False, f"Note '{note_id}' is not associated with rubric '{rubric_id}'"
        
        return True, None
    
    @staticmethod
    def check_data_integrity(store: LectureNotesStore) -> List[str]:
        """
        Check data integrity of the store.
        
        Args:
            store: LectureNotesStore instance
            
        Returns:
            List of integrity issues found (empty if no issues)
        """
        issues = []
        
        # Check for orphaned associations in rubric_associations
        for rubric_id, note_ids in store.rubric_associations.items():
            for note_id in note_ids:
                if note_id not in store.notes:
                    issues.append(f"Orphaned association: rubric '{rubric_id}' references non-existent note '{note_id}'")
        
        # Check for inconsistent associations
        for note_id, note in store.notes.items():
            for rubric_id in note.associated_rubrics:
                if rubric_id not in store.rubric_associations:
                    issues.append(f"Inconsistent association: note '{note_id}' references rubric '{rubric_id}' not in rubric_associations")
                elif note_id not in store.rubric_associations[rubric_id]:
                    issues.append(f"Inconsistent association: note '{note_id}' references rubric '{rubric_id}' but reverse mapping missing")
        
        # Check for duplicate note IDs (shouldn't happen but validate)
        note_ids = list(store.notes.keys())
        if len(note_ids) != len(set(note_ids)):
            issues.append("Duplicate note IDs found in store")
        
        # Validate note data
        for note_id, note in store.notes.items():
            if note.id != note_id:
                issues.append(f"Note ID mismatch: key '{note_id}' != note.id '{note.id}'")
            
            if note.file_size < 0:
                issues.append(f"Note '{note_id}' has invalid file size: {note.file_size}")
            
            if note.word_count is not None and note.word_count < 0:
                issues.append(f"Note '{note_id}' has invalid word count: {note.word_count}")
        
        return issues
    
    @staticmethod
    def resolve_duplicate_associations(store: LectureNotesStore) -> int:
        """
        Resolve duplicate associations by removing duplicates.
        
        Args:
            store: LectureNotesStore instance
            
        Returns:
            Number of duplicates resolved
        """
        resolved_count = 0
        
        # Remove duplicates from note associations
        for note in store.notes.values():
            original_count = len(note.associated_rubrics)
            note.associated_rubrics = list(set(note.associated_rubrics))
            resolved_count += original_count - len(note.associated_rubrics)
        
        # Remove duplicates from rubric associations
        for rubric_id in store.rubric_associations:
            original_count = len(store.rubric_associations[rubric_id])
            store.rubric_associations[rubric_id] = list(set(store.rubric_associations[rubric_id]))
            resolved_count += original_count - len(store.rubric_associations[rubric_id])
        
        return resolved_count
    
    @staticmethod
    def repair_data_integrity(store: LectureNotesStore) -> Dict[str, int]:
        """
        Attempt to repair data integrity issues.
        
        Args:
            store: LectureNotesStore instance
            
        Returns:
            Dictionary with repair statistics
        """
        stats = {
            'orphaned_associations_removed': 0,
            'inconsistent_associations_fixed': 0,
            'duplicates_resolved': 0
        }
        
        # Remove orphaned associations from rubric_associations
        for rubric_id in list(store.rubric_associations.keys()):
            note_ids = store.rubric_associations[rubric_id]
            valid_note_ids = [nid for nid in note_ids if nid in store.notes]
            removed = len(note_ids) - len(valid_note_ids)
            if removed > 0:
                store.rubric_associations[rubric_id] = valid_note_ids
                stats['orphaned_associations_removed'] += removed
            
            # Remove empty rubric associations
            if not store.rubric_associations[rubric_id]:
                del store.rubric_associations[rubric_id]
        
        # Fix inconsistent associations
        for note in store.notes.values():
            for rubric_id in note.associated_rubrics:
                if rubric_id not in store.rubric_associations:
                    store.rubric_associations[rubric_id] = []
                
                if note.id not in store.rubric_associations[rubric_id]:
                    store.rubric_associations[rubric_id].append(note.id)
                    stats['inconsistent_associations_fixed'] += 1
        
        # Resolve duplicates
        stats['duplicates_resolved'] = AssociationValidator.resolve_duplicate_associations(store)
        
        return stats


class LectureNotesStorage:
    """Manages JSON storage for lecture notes and their associations."""
    
    def __init__(self, storage_path: Optional[str] = None):
        """
        Initialize lecture notes storage.
        
        Args:
            storage_path: Path to JSON storage file (defaults to src/data/lecture_notes.json)
        """
        if storage_path:
            self.storage_path = storage_path
        else:
            # Default path relative to this file
            current_dir = Path(__file__).parent
            self.storage_path = str(current_dir.parent / "data" / "lecture_notes.json")
        
        self.validator = AssociationValidator()
        
        # Ensure the storage file exists
        self._ensure_storage_file()
        
        # Perform integrity check on initialization
        self._check_and_repair_integrity()
    
    def _ensure_storage_file(self) -> None:
        """Ensure the storage file exists, create if it doesn't."""
        try:
            if not os.path.exists(self.storage_path):
                os.makedirs(os.path.dirname(self.storage_path), exist_ok=True)
                empty_store = LectureNotesStore()
                with open(self.storage_path, 'w', encoding='utf-8') as f:
                    json.dump(empty_store.model_dump(), f, indent=2, default=str)
                logger.info(f"Created lecture notes storage file at {self.storage_path}")
        except Exception as e:
            logger.error(f"Failed to ensure storage file exists: {e}")
            raise
    
    def _check_and_repair_integrity(self) -> None:
        """Check and repair data integrity on initialization."""
        try:
            store = self._load_store()
            
            # Check for integrity issues
            issues = self.validator.check_data_integrity(store)
            
            if issues:
                logger.warning(f"Found {len(issues)} data integrity issues:")
                for issue in issues[:10]:  # Log first 10 issues
                    logger.warning(f"  - {issue}")
                
                # Attempt to repair
                logger.info("Attempting to repair data integrity issues...")
                repair_stats = self.validator.repair_data_integrity(store)
                
                logger.info(f"Repair completed: {repair_stats}")
                
                # Save repaired store
                self._save_store(store)
                
                # Verify repair
                remaining_issues = self.validator.check_data_integrity(store)
                if remaining_issues:
                    logger.error(f"Failed to repair all issues. {len(remaining_issues)} issues remain.")
                else:
                    logger.info("All data integrity issues resolved successfully")
            else:
                logger.debug("Data integrity check passed")
                
        except Exception as e:
            logger.error(f"Failed to check/repair data integrity: {e}")
            # Don't fail initialization, but log the error
    
    def _load_store(self) -> LectureNotesStore:
        """Load the lecture notes store from JSON."""
        try:
            if not os.path.exists(self.storage_path):
                return LectureNotesStore()
            
            with open(self.storage_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # Convert notes dict to LectureNote objects
            if 'notes' in data:
                notes = {}
                for note_id, note_data in data['notes'].items():
                    # Handle datetime fields
                    if isinstance(note_data.get('uploaded_at'), str):
                        note_data['uploaded_at'] = datetime.fromisoformat(note_data['uploaded_at'].replace('Z', '+00:00'))
                    if note_data.get('processed_at') and isinstance(note_data['processed_at'], str):
                        note_data['processed_at'] = datetime.fromisoformat(note_data['processed_at'].replace('Z', '+00:00'))
                    
                    notes[note_id] = LectureNote(**note_data)
                data['notes'] = notes
            
            return LectureNotesStore(**data)
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse lecture notes JSON: {e}")
            return LectureNotesStore()
        except Exception as e:
            logger.error(f"Failed to load lecture notes store: {e}")
            return LectureNotesStore()
    
    def _save_store(self, store: LectureNotesStore) -> None:
        """
        Save the lecture notes store to JSON with backup mechanism.
        
        Args:
            store: LectureNotesStore to save
            
        Raises:
            Exception: If save operation fails
        """
        try:
            # Create backup of existing file before saving
            if os.path.exists(self.storage_path):
                backup_path = f"{self.storage_path}.backup"
                try:
                    import shutil
                    shutil.copy2(self.storage_path, backup_path)
                    logger.debug(f"Created backup at {backup_path}")
                except Exception as e:
                    logger.warning(f"Failed to create backup: {e}")
            
            # Write to temporary file first
            temp_path = f"{self.storage_path}.tmp"
            with open(temp_path, 'w', encoding='utf-8') as f:
                json.dump(store.model_dump(), f, indent=2, default=str, ensure_ascii=False)
            
            # Verify the written file is valid JSON
            with open(temp_path, 'r', encoding='utf-8') as f:
                json.load(f)  # This will raise if JSON is invalid
            
            # Move temporary file to actual location (atomic operation on most systems)
            import shutil
            shutil.move(temp_path, self.storage_path)
            
            logger.debug(f"Saved lecture notes store with {len(store.notes)} notes")
            
        except Exception as e:
            logger.error(f"Failed to save lecture notes store: {e}")
            
            # Attempt to restore from backup if save failed
            backup_path = f"{self.storage_path}.backup"
            if os.path.exists(backup_path):
                try:
                    import shutil
                    shutil.copy2(backup_path, self.storage_path)
                    logger.info("Restored from backup after save failure")
                except Exception as restore_error:
                    logger.error(f"Failed to restore from backup: {restore_error}")
            
            raise
    
    def create_lecture_note(
        self,
        original_name: str,
        file_size: int,
        file_type: str,
        extracted_content: Optional[str] = None
    ) -> LectureNote:
        """
        Create a new lecture note entry.
        
        Args:
            original_name: Original filename as uploaded
            file_size: File size in bytes
            file_type: File type ('pdf', 'docx', 'txt', 'md')
            extracted_content: Extracted text content (optional)
            
        Returns:
            Created LectureNote object
        """
        try:
            note_id = str(uuid4())
            filename = f"{note_id}_{original_name}"
            
            note = LectureNote(
                id=note_id,
                filename=filename,
                original_name=original_name,
                file_size=file_size,
                file_type=file_type,
                extracted_content=extracted_content,
                word_count=len(extracted_content.split()) if extracted_content else None
            )
            
            if extracted_content:
                note.processed_at = datetime.now()
            
            store = self._load_store()
            store.add_note(note)
            self._save_store(store)
            
            logger.info(f"Created lecture note: {note_id} ({original_name})")
            return note
            
        except Exception as e:
            logger.error(f"Failed to create lecture note: {e}")
            raise
    
    def get_lecture_note(self, note_id: str) -> Optional[LectureNote]:
        """
        Get a lecture note by ID.
        
        Args:
            note_id: Note identifier
            
        Returns:
            LectureNote object or None if not found
        """
        store = self._load_store()
        return store.notes.get(note_id)
    
    def get_all_lecture_notes(self) -> List[LectureNote]:
        """
        Get all lecture notes.
        
        Returns:
            List of all LectureNote objects
        """
        store = self._load_store()
        return list(store.notes.values())
    
    def update_lecture_note(self, note: LectureNote) -> bool:
        """
        Update an existing lecture note.
        
        Args:
            note: Updated LectureNote object
            
        Returns:
            True if updated successfully, False if not found
        """
        try:
            store = self._load_store()
            if note.id in store.notes:
                store.notes[note.id] = note
                store.metadata["last_updated"] = datetime.now().isoformat()
                self._save_store(store)
                logger.info(f"Updated lecture note: {note.id}")
                return True
            else:
                logger.warning(f"Lecture note not found for update: {note.id}")
                return False
        except Exception as e:
            logger.error(f"Failed to update lecture note: {e}")
            return False
    
    def delete_lecture_note(self, note_id: str) -> bool:
        """
        Delete a lecture note by ID.
        
        Args:
            note_id: Note identifier
            
        Returns:
            True if deleted successfully, False if not found
        """
        try:
            store = self._load_store()
            if store.remove_note(note_id):
                self._save_store(store)
                logger.info(f"Deleted lecture note: {note_id}")
                return True
            else:
                logger.warning(f"Lecture note not found for deletion: {note_id}")
                return False
        except Exception as e:
            logger.error(f"Failed to delete lecture note: {e}")
            return False
    
    def associate_note_with_rubric(self, note_id: str, rubric_id: str) -> bool:
        """
        Associate a lecture note with a rubric with validation.
        
        Args:
            note_id: Note identifier
            rubric_id: Rubric identifier
            
        Returns:
            True if associated successfully, False if validation fails
            
        Raises:
            ValidationError: If validation fails with details
        """
        try:
            store = self._load_store()
            
            # Validate association before creation
            is_valid, error_message = self.validator.validate_association(note_id, rubric_id, store)
            if not is_valid:
                logger.warning(f"Association validation failed: {error_message}")
                raise ValidationError(
                    message="Invalid association",
                    details=error_message,
                    context={'note_id': note_id, 'rubric_id': rubric_id}
                )
            
            # Perform association
            if store.associate_note_with_rubric(note_id, rubric_id):
                self._save_store(store)
                logger.info(f"Associated note {note_id} with rubric {rubric_id}")
                return True
            else:
                logger.warning(f"Failed to associate note {note_id} with rubric {rubric_id}")
                return False
                
        except ValidationError:
            raise
        except Exception as e:
            logger.error(f"Failed to associate note with rubric: {e}")
            raise IntegrationError(
                message="Association operation failed",
                details=str(e),
                context={'note_id': note_id, 'rubric_id': rubric_id}
            )
    
    def disassociate_note_from_rubric(self, note_id: str, rubric_id: str) -> bool:
        """
        Remove association between a lecture note and rubric with validation.
        
        Args:
            note_id: Note identifier
            rubric_id: Rubric identifier
            
        Returns:
            True if disassociated successfully, False if validation fails
            
        Raises:
            ValidationError: If validation fails with details
        """
        try:
            store = self._load_store()
            
            # Validate disassociation before removal
            is_valid, error_message = self.validator.validate_disassociation(note_id, rubric_id, store)
            if not is_valid:
                logger.warning(f"Disassociation validation failed: {error_message}")
                raise ValidationError(
                    message="Invalid disassociation",
                    details=error_message,
                    context={'note_id': note_id, 'rubric_id': rubric_id}
                )
            
            # Perform disassociation
            if store.disassociate_note_from_rubric(note_id, rubric_id):
                self._save_store(store)
                logger.info(f"Disassociated note {note_id} from rubric {rubric_id}")
                return True
            else:
                logger.warning(f"Failed to disassociate note {note_id} from rubric {rubric_id}")
                return False
                
        except ValidationError:
            raise
        except Exception as e:
            logger.error(f"Failed to disassociate note from rubric: {e}")
            raise IntegrationError(
                message="Disassociation operation failed",
                details=str(e),
                context={'note_id': note_id, 'rubric_id': rubric_id}
            )
    
    def get_notes_for_rubric(self, rubric_id: str) -> List[LectureNote]:
        """
        Get all lecture notes associated with a rubric.
        
        Args:
            rubric_id: Rubric identifier
            
        Returns:
            List of associated LectureNote objects
        """
        store = self._load_store()
        return store.get_notes_for_rubric(rubric_id)
    
    def get_rubrics_for_note(self, note_id: str) -> List[str]:
        """
        Get all rubric IDs associated with a lecture note.
        
        Args:
            note_id: Note identifier
            
        Returns:
            List of rubric IDs
        """
        note = self.get_lecture_note(note_id)
        return note.associated_rubrics if note else []
    
    def search_notes(self, query: str, rubric_id: Optional[str] = None) -> List[LectureNote]:
        """
        Search lecture notes by content.
        
        Args:
            query: Search query string
            rubric_id: Optional rubric ID to filter by
            
        Returns:
            List of matching LectureNote objects
        """
        try:
            store = self._load_store()
            notes = list(store.notes.values())
            
            # Filter by rubric if specified
            if rubric_id:
                notes = [note for note in notes if rubric_id in note.associated_rubrics]
            
            # Search in content
            query_lower = query.lower()
            matching_notes = []
            
            for note in notes:
                # Search in original name
                if query_lower in note.original_name.lower():
                    matching_notes.append(note)
                    continue
                
                # Search in extracted content
                if note.extracted_content and query_lower in note.extracted_content.lower():
                    matching_notes.append(note)
                    continue
            
            logger.debug(f"Found {len(matching_notes)} notes matching query: {query}")
            return matching_notes
            
        except Exception as e:
            logger.error(f"Failed to search notes: {e}")
            return []
    
    def get_statistics(self) -> Dict[str, Any]:
        """
        Get statistics about stored lecture notes.
        
        Returns:
            Dictionary with statistics
        """
        try:
            store = self._load_store()
            notes = list(store.notes.values())
            
            if not notes:
                return {
                    "total_notes": 0,
                    "total_size_bytes": 0,
                    "file_types": {},
                    "processing_status": {},
                    "total_associations": 0,
                    "date_range": None
                }
            
            # Calculate statistics
            total_size = sum(note.file_size for note in notes)
            
            file_types = {}
            processing_status = {}
            total_associations = 0
            
            for note in notes:
                # File types
                file_types[note.file_type] = file_types.get(note.file_type, 0) + 1
                
                # Processing status
                status = note.processing_status.value
                processing_status[status] = processing_status.get(status, 0) + 1
                
                # Associations
                total_associations += len(note.associated_rubrics)
            
            # Date range
            upload_dates = [note.uploaded_at for note in notes]
            upload_dates.sort()
            date_range = {
                "earliest": upload_dates[0].isoformat(),
                "latest": upload_dates[-1].isoformat()
            } if upload_dates else None
            
            return {
                "total_notes": len(notes),
                "total_size_bytes": total_size,
                "total_size_mb": round(total_size / (1024 * 1024), 2),
                "file_types": file_types,
                "processing_status": processing_status,
                "total_associations": total_associations,
                "unique_rubrics": len(store.rubric_associations),
                "date_range": date_range
            }
            
        except Exception as e:
            logger.error(f"Failed to calculate statistics: {e}")
            return {"error": str(e)}
    
    def export_to_json(self, output_path: str) -> bool:
        """
        Export lecture notes to JSON format.
        
        Args:
            output_path: Path for JSON output file
            
        Returns:
            True if successful, False otherwise
        """
        try:
            store = self._load_store()
            
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(store.model_dump(), f, indent=2, default=str, ensure_ascii=False)
            
            logger.info(f"Exported {len(store.notes)} lecture notes to {output_path}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to export to JSON: {e}")
            return False
    
    def clear_all_notes(self) -> int:
        """
        Clear all lecture notes from storage.
        
        Returns:
            Number of notes cleared
        """
        try:
            store = self._load_store()
            count = len(store.notes)
            
            empty_store = LectureNotesStore()
            self._save_store(empty_store)
            
            logger.info(f"Cleared {count} lecture notes from storage")
            return count
            
        except Exception as e:
            logger.error(f"Failed to clear lecture notes: {e}")
            return 0
    
    def validate_data_integrity(self) -> Dict[str, Any]:
        """
        Validate data integrity and return detailed report.
        
        Returns:
            Dictionary with validation results
        """
        try:
            store = self._load_store()
            issues = self.validator.check_data_integrity(store)
            
            return {
                'valid': len(issues) == 0,
                'issue_count': len(issues),
                'issues': issues,
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Failed to validate data integrity: {e}")
            return {
                'valid': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
    
    def repair_data_integrity(self) -> Dict[str, Any]:
        """
        Repair data integrity issues and return repair report.
        
        Returns:
            Dictionary with repair results
        """
        try:
            store = self._load_store()
            
            # Check issues before repair
            issues_before = self.validator.check_data_integrity(store)
            
            # Perform repair
            repair_stats = self.validator.repair_data_integrity(store)
            
            # Save repaired store
            self._save_store(store)
            
            # Check issues after repair
            issues_after = self.validator.check_data_integrity(store)
            
            return {
                'success': True,
                'issues_before': len(issues_before),
                'issues_after': len(issues_after),
                'repair_stats': repair_stats,
                'remaining_issues': issues_after,
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Failed to repair data integrity: {e}")
            return {
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
    
    def validate_note_data(self, note: LectureNote) -> Tuple[bool, List[str]]:
        """
        Validate individual note data.
        
        Args:
            note: LectureNote to validate
            
        Returns:
            Tuple of (is_valid, list of validation errors)
        """
        errors = []
        
        # Validate required fields
        if not note.id:
            errors.append("Note ID is required")
        
        if not note.filename:
            errors.append("Filename is required")
        
        if not note.original_name:
            errors.append("Original name is required")
        
        if note.file_size < 0:
            errors.append(f"Invalid file size: {note.file_size}")
        
        if note.file_type not in ['pdf', 'docx', 'txt', 'md']:
            errors.append(f"Invalid file type: {note.file_type}")
        
        # Validate optional fields
        if note.word_count is not None and note.word_count < 0:
            errors.append(f"Invalid word count: {note.word_count}")
        
        # Validate dates
        if note.processed_at and note.processed_at < note.uploaded_at:
            errors.append("Processed date cannot be before upload date")
        
        # Validate processing status
        if note.processing_status == ProcessingStatus.COMPLETED and not note.extracted_content:
            errors.append("Note marked as completed but has no extracted content")
        
        if note.processing_status == ProcessingStatus.FAILED and not note.metadata.get('processing_error'):
            errors.append("Note marked as failed but has no error message")
        
        return len(errors) == 0, errors
    
    def batch_validate_associations(self, associations: List[Tuple[str, str]]) -> Dict[str, Any]:
        """
        Validate multiple associations in batch.
        
        Args:
            associations: List of (note_id, rubric_id) tuples
            
        Returns:
            Dictionary with validation results
        """
        try:
            store = self._load_store()
            results = {
                'total': len(associations),
                'valid': 0,
                'invalid': 0,
                'errors': []
            }
            
            for note_id, rubric_id in associations:
                is_valid, error_message = self.validator.validate_association(note_id, rubric_id, store)
                if is_valid:
                    results['valid'] += 1
                else:
                    results['invalid'] += 1
                    results['errors'].append({
                        'note_id': note_id,
                        'rubric_id': rubric_id,
                        'error': error_message
                    })
            
            return results
            
        except Exception as e:
            logger.error(f"Failed to batch validate associations: {e}")
            return {
                'error': str(e)
            }
    
    # ========== Backup and Recovery Methods ==========
    
    def create_backup(self, backup_path: Optional[str] = None) -> str:
        """
        Create a backup of the current storage file.
        
        Args:
            backup_path: Optional custom backup path (defaults to storage_path.backup.timestamp)
            
        Returns:
            Path to the created backup file
            
        Raises:
            Exception: If backup creation fails
        """
        try:
            import shutil
            
            if not os.path.exists(self.storage_path):
                raise FileNotFoundError(f"Storage file not found: {self.storage_path}")
            
            # Generate backup path with timestamp
            if not backup_path:
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                backup_path = f"{self.storage_path}.backup.{timestamp}"
            
            # Create backup
            shutil.copy2(self.storage_path, backup_path)
            logger.info(f"Created backup at {backup_path}")
            
            return backup_path
            
        except Exception as e:
            logger.error(f"Failed to create backup: {e}")
            raise
    
    def restore_from_backup(self, backup_path: str) -> bool:
        """
        Restore storage from a backup file.
        
        Args:
            backup_path: Path to the backup file
            
        Returns:
            True if restored successfully, False otherwise
            
        Raises:
            Exception: If restore operation fails
        """
        try:
            import shutil
            
            if not os.path.exists(backup_path):
                raise FileNotFoundError(f"Backup file not found: {backup_path}")
            
            # Validate backup file is valid JSON
            with open(backup_path, 'r', encoding='utf-8') as f:
                json.load(f)  # This will raise if JSON is invalid
            
            # Create a backup of current file before restoring
            if os.path.exists(self.storage_path):
                pre_restore_backup = f"{self.storage_path}.pre_restore.{datetime.now().strftime('%Y%m%d_%H%M%S')}"
                shutil.copy2(self.storage_path, pre_restore_backup)
                logger.info(f"Created pre-restore backup at {pre_restore_backup}")
            
            # Restore from backup
            shutil.copy2(backup_path, self.storage_path)
            logger.info(f"Restored storage from backup: {backup_path}")
            
            # Verify restored data
            self._check_and_repair_integrity()
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to restore from backup: {e}")
            raise
    
    def list_backups(self, backup_dir: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        List all available backup files.
        
        Args:
            backup_dir: Optional directory to search for backups (defaults to storage directory)
            
        Returns:
            List of backup file information dictionaries
        """
        try:
            if not backup_dir:
                backup_dir = os.path.dirname(self.storage_path)
            
            storage_filename = os.path.basename(self.storage_path)
            backup_pattern = f"{storage_filename}.backup"
            
            backups = []
            for filename in os.listdir(backup_dir):
                if filename.startswith(backup_pattern):
                    filepath = os.path.join(backup_dir, filename)
                    stat_info = os.stat(filepath)
                    
                    backups.append({
                        'filename': filename,
                        'path': filepath,
                        'size_bytes': stat_info.st_size,
                        'created_at': datetime.fromtimestamp(stat_info.st_ctime).isoformat(),
                        'modified_at': datetime.fromtimestamp(stat_info.st_mtime).isoformat()
                    })
            
            # Sort by creation time (newest first)
            backups.sort(key=lambda x: x['created_at'], reverse=True)
            
            logger.debug(f"Found {len(backups)} backup files")
            return backups
            
        except Exception as e:
            logger.error(f"Failed to list backups: {e}")
            return []
    
    def cleanup_old_backups(self, keep_count: int = 5) -> int:
        """
        Clean up old backup files, keeping only the most recent ones.
        
        Args:
            keep_count: Number of recent backups to keep
            
        Returns:
            Number of backups deleted
        """
        try:
            backups = self.list_backups()
            
            if len(backups) <= keep_count:
                logger.debug(f"No backups to clean up ({len(backups)} <= {keep_count})")
                return 0
            
            # Delete old backups
            deleted_count = 0
            for backup in backups[keep_count:]:
                try:
                    os.unlink(backup['path'])
                    logger.info(f"Deleted old backup: {backup['filename']}")
                    deleted_count += 1
                except Exception as e:
                    logger.warning(f"Failed to delete backup {backup['filename']}: {e}")
            
            logger.info(f"Cleaned up {deleted_count} old backup files")
            return deleted_count
            
        except Exception as e:
            logger.error(f"Failed to cleanup old backups: {e}")
            return 0
    
    # ========== Data Migration Methods ==========
    
    def migrate_from_legacy_format(self, legacy_data_path: str) -> Dict[str, Any]:
        """
        Migrate data from legacy format to current format.
        
        Args:
            legacy_data_path: Path to legacy data file
            
        Returns:
            Dictionary with migration results
        """
        try:
            logger.info(f"Starting migration from legacy format: {legacy_data_path}")
            
            # Load legacy data
            with open(legacy_data_path, 'r', encoding='utf-8') as f:
                legacy_data = json.load(f)
            
            migration_stats = {
                'notes_migrated': 0,
                'associations_migrated': 0,
                'errors': []
            }
            
            # Migrate notes
            if isinstance(legacy_data, list):
                # Legacy format: list of notes
                for legacy_note in legacy_data:
                    try:
                        note = self._convert_legacy_note(legacy_note)
                        store = self._load_store()
                        store.add_note(note)
                        self._save_store(store)
                        migration_stats['notes_migrated'] += 1
                    except Exception as e:
                        migration_stats['errors'].append(f"Failed to migrate note: {e}")
            
            elif isinstance(legacy_data, dict):
                # Legacy format: dictionary with notes and associations
                if 'notes' in legacy_data:
                    for note_id, legacy_note in legacy_data['notes'].items():
                        try:
                            note = self._convert_legacy_note(legacy_note)
                            store = self._load_store()
                            store.add_note(note)
                            self._save_store(store)
                            migration_stats['notes_migrated'] += 1
                        except Exception as e:
                            migration_stats['errors'].append(f"Failed to migrate note {note_id}: {e}")
                
                if 'associations' in legacy_data:
                    for rubric_id, note_ids in legacy_data['associations'].items():
                        for note_id in note_ids:
                            try:
                                self.associate_note_with_rubric(note_id, rubric_id)
                                migration_stats['associations_migrated'] += 1
                            except Exception as e:
                                migration_stats['errors'].append(f"Failed to migrate association {note_id}-{rubric_id}: {e}")
            
            logger.info(f"Migration completed: {migration_stats}")
            return migration_stats
            
        except Exception as e:
            logger.error(f"Migration failed: {e}")
            return {
                'error': str(e),
                'notes_migrated': 0,
                'associations_migrated': 0
            }
    
    def _convert_legacy_note(self, legacy_note: Dict[str, Any]) -> LectureNote:
        """
        Convert legacy note format to current LectureNote model.
        
        Args:
            legacy_note: Legacy note dictionary
            
        Returns:
            LectureNote object
        """
        # Map legacy fields to current fields
        note_data = {
            'id': legacy_note.get('id', str(uuid4())),
            'filename': legacy_note.get('filename', legacy_note.get('file_name', 'unknown')),
            'original_name': legacy_note.get('original_name', legacy_note.get('originalName', 'unknown')),
            'file_size': legacy_note.get('file_size', legacy_note.get('fileSize', 0)),
            'file_type': legacy_note.get('file_type', legacy_note.get('fileType', 'txt')),
            'extracted_content': legacy_note.get('extracted_content', legacy_note.get('content', '')),
            'word_count': legacy_note.get('word_count', legacy_note.get('wordCount')),
            'associated_rubrics': legacy_note.get('associated_rubrics', legacy_note.get('rubrics', []))
        }
        
        # Handle datetime fields
        if 'uploaded_at' in legacy_note:
            note_data['uploaded_at'] = datetime.fromisoformat(legacy_note['uploaded_at'].replace('Z', '+00:00'))
        elif 'uploadedAt' in legacy_note:
            note_data['uploaded_at'] = datetime.fromisoformat(legacy_note['uploadedAt'].replace('Z', '+00:00'))
        
        if 'processed_at' in legacy_note:
            note_data['processed_at'] = datetime.fromisoformat(legacy_note['processed_at'].replace('Z', '+00:00'))
        elif 'processedAt' in legacy_note:
            note_data['processed_at'] = datetime.fromisoformat(legacy_note['processedAt'].replace('Z', '+00:00'))
        
        return LectureNote(**note_data)
    
    def export_for_migration(self, output_path: str) -> bool:
        """
        Export current data in a format suitable for migration.
        
        Args:
            output_path: Path for export file
            
        Returns:
            True if successful, False otherwise
        """
        try:
            store = self._load_store()
            
            export_data = {
                'version': '1.0',
                'exported_at': datetime.now().isoformat(),
                'notes': {note_id: note.model_dump() for note_id, note in store.notes.items()},
                'rubric_associations': store.rubric_associations,
                'metadata': store.metadata
            }
            
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(export_data, f, indent=2, default=str, ensure_ascii=False)
            
            logger.info(f"Exported data for migration to {output_path}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to export for migration: {e}")
            return False
    
    # ========== File Cleanup and Management Methods ==========
    
    def detect_orphaned_files(self, files_directory: str) -> List[Dict[str, Any]]:
        """
        Detect orphaned files that exist in the filesystem but not in storage.
        
        Args:
            files_directory: Directory containing lecture note files
            
        Returns:
            List of orphaned file information dictionaries
        """
        try:
            store = self._load_store()
            tracked_filenames = {note.filename for note in store.notes.values()}
            
            orphaned_files = []
            
            if not os.path.exists(files_directory):
                logger.warning(f"Files directory does not exist: {files_directory}")
                return orphaned_files
            
            for filename in os.listdir(files_directory):
                filepath = os.path.join(files_directory, filename)
                
                # Skip directories
                if os.path.isdir(filepath):
                    continue
                
                # Check if file is tracked
                if filename not in tracked_filenames:
                    stat_info = os.stat(filepath)
                    orphaned_files.append({
                        'filename': filename,
                        'path': filepath,
                        'size_bytes': stat_info.st_size,
                        'modified_at': datetime.fromtimestamp(stat_info.st_mtime).isoformat()
                    })
            
            logger.info(f"Found {len(orphaned_files)} orphaned files")
            return orphaned_files
            
        except Exception as e:
            logger.error(f"Failed to detect orphaned files: {e}")
            return []
    
    def cleanup_orphaned_files(self, files_directory: str, dry_run: bool = True) -> Dict[str, Any]:
        """
        Clean up orphaned files from the filesystem.
        
        Args:
            files_directory: Directory containing lecture note files
            dry_run: If True, only report what would be deleted without actually deleting
            
        Returns:
            Dictionary with cleanup results
        """
        try:
            orphaned_files = self.detect_orphaned_files(files_directory)
            
            results = {
                'total_orphaned': len(orphaned_files),
                'deleted': 0,
                'failed': 0,
                'total_size_freed_bytes': 0,
                'errors': [],
                'dry_run': dry_run
            }
            
            for file_info in orphaned_files:
                if dry_run:
                    results['total_size_freed_bytes'] += file_info['size_bytes']
                else:
                    try:
                        os.unlink(file_info['path'])
                        results['deleted'] += 1
                        results['total_size_freed_bytes'] += file_info['size_bytes']
                        logger.info(f"Deleted orphaned file: {file_info['filename']}")
                    except Exception as e:
                        results['failed'] += 1
                        results['errors'].append(f"Failed to delete {file_info['filename']}: {e}")
            
            if dry_run:
                logger.info(f"Dry run: Would delete {len(orphaned_files)} orphaned files ({results['total_size_freed_bytes']} bytes)")
            else:
                logger.info(f"Cleaned up {results['deleted']} orphaned files ({results['total_size_freed_bytes']} bytes)")
            
            return results
            
        except Exception as e:
            logger.error(f"Failed to cleanup orphaned files: {e}")
            return {
                'error': str(e),
                'total_orphaned': 0,
                'deleted': 0
            }
    
    def detect_missing_files(self, files_directory: str) -> List[Dict[str, Any]]:
        """
        Detect notes in storage that have missing files in the filesystem.
        
        Args:
            files_directory: Directory containing lecture note files
            
        Returns:
            List of notes with missing files
        """
        try:
            store = self._load_store()
            missing_files = []
            
            for note_id, note in store.notes.items():
                filepath = os.path.join(files_directory, note.filename)
                
                if not os.path.exists(filepath):
                    missing_files.append({
                        'note_id': note_id,
                        'filename': note.filename,
                        'original_name': note.original_name,
                        'uploaded_at': note.uploaded_at.isoformat(),
                        'file_size': note.file_size
                    })
            
            logger.info(f"Found {len(missing_files)} notes with missing files")
            return missing_files
            
        except Exception as e:
            logger.error(f"Failed to detect missing files: {e}")
            return []
    
    def get_storage_quota_info(self, files_directory: str, quota_bytes: Optional[int] = None) -> Dict[str, Any]:
        """
        Get storage quota information and usage statistics.
        
        Args:
            files_directory: Directory containing lecture note files
            quota_bytes: Optional storage quota in bytes (defaults to 1GB)
            
        Returns:
            Dictionary with quota information
        """
        try:
            if quota_bytes is None:
                quota_bytes = 1024 * 1024 * 1024  # 1GB default
            
            store = self._load_store()
            
            # Calculate total size from storage metadata
            total_size_tracked = sum(note.file_size for note in store.notes.values())
            
            # Calculate actual disk usage
            actual_disk_usage = 0
            if os.path.exists(files_directory):
                for filename in os.listdir(files_directory):
                    filepath = os.path.join(files_directory, filename)
                    if os.path.isfile(filepath):
                        actual_disk_usage += os.path.getsize(filepath)
            
            usage_percentage = (actual_disk_usage / quota_bytes) * 100 if quota_bytes > 0 else 0
            
            quota_info = {
                'quota_bytes': quota_bytes,
                'quota_mb': round(quota_bytes / (1024 * 1024), 2),
                'used_bytes': actual_disk_usage,
                'used_mb': round(actual_disk_usage / (1024 * 1024), 2),
                'available_bytes': max(0, quota_bytes - actual_disk_usage),
                'available_mb': round(max(0, quota_bytes - actual_disk_usage) / (1024 * 1024), 2),
                'usage_percentage': round(usage_percentage, 2),
                'tracked_size_bytes': total_size_tracked,
                'tracked_size_mb': round(total_size_tracked / (1024 * 1024), 2),
                'total_notes': len(store.notes),
                'warning': usage_percentage > 80,
                'critical': usage_percentage > 95
            }
            
            if quota_info['warning']:
                logger.warning(f"Storage quota warning: {usage_percentage:.1f}% used")
            
            return quota_info
            
        except Exception as e:
            logger.error(f"Failed to get storage quota info: {e}")
            return {
                'error': str(e)
            }
    
    def batch_delete_notes(self, note_ids: List[str]) -> Dict[str, Any]:
        """
        Delete multiple notes in a batch operation.
        
        Args:
            note_ids: List of note IDs to delete
            
        Returns:
            Dictionary with batch deletion results
        """
        try:
            results = {
                'total': len(note_ids),
                'deleted': 0,
                'failed': 0,
                'errors': []
            }
            
            for note_id in note_ids:
                try:
                    if self.delete_lecture_note(note_id):
                        results['deleted'] += 1
                    else:
                        results['failed'] += 1
                        results['errors'].append(f"Note not found: {note_id}")
                except Exception as e:
                    results['failed'] += 1
                    results['errors'].append(f"Failed to delete {note_id}: {e}")
            
            logger.info(f"Batch delete completed: {results['deleted']}/{results['total']} deleted")
            return results
            
        except Exception as e:
            logger.error(f"Batch delete failed: {e}")
            return {
                'error': str(e),
                'total': len(note_ids),
                'deleted': 0
            }
    
    def batch_associate_notes(self, note_ids: List[str], rubric_id: str) -> Dict[str, Any]:
        """
        Associate multiple notes with a rubric in a batch operation.
        
        Args:
            note_ids: List of note IDs to associate
            rubric_id: Rubric ID to associate with
            
        Returns:
            Dictionary with batch association results
        """
        try:
            results = {
                'total': len(note_ids),
                'associated': 0,
                'failed': 0,
                'errors': []
            }
            
            for note_id in note_ids:
                try:
                    if self.associate_note_with_rubric(note_id, rubric_id):
                        results['associated'] += 1
                    else:
                        results['failed'] += 1
                        results['errors'].append(f"Failed to associate {note_id}")
                except Exception as e:
                    results['failed'] += 1
                    results['errors'].append(f"Failed to associate {note_id}: {e}")
            
            logger.info(f"Batch associate completed: {results['associated']}/{results['total']} associated")
            return results
            
        except Exception as e:
            logger.error(f"Batch associate failed: {e}")
            return {
                'error': str(e),
                'total': len(note_ids),
                'associated': 0
            }
    
    def batch_disassociate_notes(self, note_ids: List[str], rubric_id: str) -> Dict[str, Any]:
        """
        Disassociate multiple notes from a rubric in a batch operation.
        
        Args:
            note_ids: List of note IDs to disassociate
            rubric_id: Rubric ID to disassociate from
            
        Returns:
            Dictionary with batch disassociation results
        """
        try:
            results = {
                'total': len(note_ids),
                'disassociated': 0,
                'failed': 0,
                'errors': []
            }
            
            for note_id in note_ids:
                try:
                    if self.disassociate_note_from_rubric(note_id, rubric_id):
                        results['disassociated'] += 1
                    else:
                        results['failed'] += 1
                        results['errors'].append(f"Failed to disassociate {note_id}")
                except Exception as e:
                    results['failed'] += 1
                    results['errors'].append(f"Failed to disassociate {note_id}: {e}")
            
            logger.info(f"Batch disassociate completed: {results['disassociated']}/{results['total']} disassociated")
            return results
            
        except Exception as e:
            logger.error(f"Batch disassociate failed: {e}")
            return {
                'error': str(e),
                'total': len(note_ids),
                'disassociated': 0
            }
    
    def perform_maintenance(self, files_directory: str, options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Perform comprehensive maintenance operations.
        
        Args:
            files_directory: Directory containing lecture note files
            options: Optional maintenance options dictionary
                - cleanup_orphaned: bool (default: False)
                - cleanup_backups: bool (default: True)
                - keep_backups: int (default: 5)
                - repair_integrity: bool (default: True)
                - dry_run: bool (default: True)
            
        Returns:
            Dictionary with maintenance results
        """
        try:
            if options is None:
                options = {}
            
            cleanup_orphaned = options.get('cleanup_orphaned', False)
            cleanup_backups = options.get('cleanup_backups', True)
            keep_backups = options.get('keep_backups', 5)
            repair_integrity = options.get('repair_integrity', True)
            dry_run = options.get('dry_run', True)
            
            results = {
                'started_at': datetime.now().isoformat(),
                'dry_run': dry_run,
                'operations': {}
            }
            
            # Create backup before maintenance
            if not dry_run:
                try:
                    backup_path = self.create_backup()
                    results['backup_created'] = backup_path
                except Exception as e:
                    results['backup_error'] = str(e)
            
            # Repair data integrity
            if repair_integrity:
                try:
                    repair_stats = self.repair_data_integrity()
                    results['operations']['integrity_repair'] = repair_stats
                except Exception as e:
                    results['operations']['integrity_repair'] = {'error': str(e)}
            
            # Cleanup orphaned files
            if cleanup_orphaned:
                try:
                    cleanup_results = self.cleanup_orphaned_files(files_directory, dry_run=dry_run)
                    results['operations']['orphaned_cleanup'] = cleanup_results
                except Exception as e:
                    results['operations']['orphaned_cleanup'] = {'error': str(e)}
            
            # Cleanup old backups
            if cleanup_backups and not dry_run:
                try:
                    deleted_count = self.cleanup_old_backups(keep_count=keep_backups)
                    results['operations']['backup_cleanup'] = {
                        'deleted_count': deleted_count,
                        'kept_count': keep_backups
                    }
                except Exception as e:
                    results['operations']['backup_cleanup'] = {'error': str(e)}
            
            # Get storage quota info
            try:
                quota_info = self.get_storage_quota_info(files_directory)
                results['quota_info'] = quota_info
            except Exception as e:
                results['quota_info'] = {'error': str(e)}
            
            # Detect missing files
            try:
                missing_files = self.detect_missing_files(files_directory)
                results['missing_files'] = {
                    'count': len(missing_files),
                    'files': missing_files[:10]  # Limit to first 10
                }
            except Exception as e:
                results['missing_files'] = {'error': str(e)}
            
            results['completed_at'] = datetime.now().isoformat()
            logger.info(f"Maintenance completed: {results}")
            
            return results
            
        except Exception as e:
            logger.error(f"Maintenance failed: {e}")
            return {
                'error': str(e),
                'started_at': datetime.now().isoformat()
            }


# Create a global instance for easy access
_default_lecture_notes_storage = None

def get_default_lecture_notes_storage() -> LectureNotesStorage:
    """Get the default lecture notes storage instance."""
    global _default_lecture_notes_storage
    if _default_lecture_notes_storage is None:
        _default_lecture_notes_storage = LectureNotesStorage()
    return _default_lecture_notes_storage

