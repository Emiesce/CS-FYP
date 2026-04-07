# Requirements Document

## Introduction

When creating or editing a rubric, users can upload lecture notes (PDF, DOCX, TXT) via the `LectureNotesSection` component. These notes should persist through the full CRUD lifecycle: after saving a create or edit, the uploaded files should remain visible when viewing or re-editing the rubric. Currently, uploaded lecture notes disappear after clicking "Update Rubric" (or "Create Rubric") and navigating back to the manage view. This spec covers fixing the persistence for both create and edit flows, and ensuring full CRUD operations on lecture notes associated with a rubric.

## Requirements

### Requirement 1: Lecture Notes Persist After Rubric Create or Update

**User Story:** As a teacher, I want uploaded lecture notes to remain associated with a rubric after I create or save edits, so that I don't have to re-upload files every time I interact with a rubric.

#### Acceptance Criteria

1. WHEN a user uploads lecture notes in the create rubric view AND clicks "Create Rubric" THEN the system SHALL save the lecture notes array as part of the new rubric data in persistent storage.
2. WHEN a user uploads lecture notes in the edit rubric view AND clicks "Update Rubric" THEN the system SHALL save the lecture notes array as part of the rubric data in persistent storage.
3. WHEN a user navigates back to the manage rubrics view after creating or updating a rubric THEN the system SHALL display the rubric with its associated lecture notes count intact.
4. WHEN a user opens the view rubric page for a rubric that has lecture notes THEN the system SHALL display all previously uploaded lecture notes.
5. WHEN a user opens the edit rubric page for a rubric that has lecture notes THEN the system SHALL pre-populate the `LectureNotesSection` with the existing lecture notes.

### Requirement 2: Lecture Notes Serialization and Deserialization

**User Story:** As a developer, I want lecture notes metadata to be correctly serialized to and deserialized from localStorage/backend storage, so that date fields and all metadata survive a page reload.

#### Acceptance Criteria

1. WHEN rubrics are saved to localStorage THEN the system SHALL serialize `lectureNotes[].uploadedAt` as an ISO string.
2. WHEN rubrics are loaded from localStorage THEN the system SHALL deserialize `lectureNotes[].uploadedAt` back to a `Date` object.
3. WHEN rubrics are loaded from localStorage THEN the system SHALL deserialize `lectureNotes[].processedAt` back to a `Date` object if it exists.
4. IF a rubric has no `lectureNotes` field in storage THEN the system SHALL default it to an empty array on load.

### Requirement 3: Add Lecture Notes to an Existing Rubric

**User Story:** As a teacher, I want to add new lecture notes to a rubric that already has some, so that I can incrementally build up the reference materials.

#### Acceptance Criteria

1. WHEN a user opens the edit view for a rubric with existing lecture notes THEN the system SHALL show those existing notes in the upload section.
2. WHEN a user uploads additional files in the edit view THEN the system SHALL append the new notes to the existing list, not replace them.
3. WHEN a user saves the rubric THEN the system SHALL persist the combined list of old and new lecture notes.

### Requirement 4: Delete Lecture Notes from a Rubric

**User Story:** As a teacher, I want to remove individual lecture notes from a rubric, so that I can keep the reference materials relevant and up to date.

#### Acceptance Criteria

1. WHEN a user clicks the remove button on a lecture note in the edit view THEN the system SHALL remove that note from the local list immediately.
2. WHEN a user saves the rubric after removing a note THEN the system SHALL persist the updated list without the removed note.
3. WHEN a user views the rubric after saving THEN the system SHALL not show the deleted note.
4. WHEN a note is removed THEN the system SHALL call `FileStorageService.removeFile` to clean up the stored file data.

### Requirement 5: Lecture Notes State Consistency Across Views

**User Story:** As a teacher, I want the lecture notes shown in the view, edit, and manage pages to always reflect the latest saved state, so that I have a consistent experience.

#### Acceptance Criteria

1. WHEN a rubric is updated THEN the system SHALL refresh the in-memory rubrics list from the service so all views reflect the latest data.
2. WHEN the edit view is opened for a rubric THEN the system SHALL always read `lectureNotes` from the latest version of the rubric in the service, not from stale component state.
3. WHEN the `LectureNotesSection` component is mounted in edit mode THEN the system SHALL initialize its internal state from the `initialNotes` prop which reflects the current saved state.
4. IF the `editingLectureNotes` state in `RubricUploadPage` is out of sync with the selected rubric's saved data THEN the system SHALL re-sync it when the edit view is opened.
