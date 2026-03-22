# Requirements Document

## Introduction

This feature adds a new page to the AI Grader application that allows instructors and TAs to upload and manage rubrics for exams. The page will integrate with the existing navigation sidebar and provide a comprehensive interface for creating, uploading, and managing grading rubrics that will be used in the grading process.

## Requirements

### Requirement 1

**User Story:** As an instructor, I want to upload rubric files for my exams, so that the AI grader can use these rubrics to evaluate student submissions consistently.

#### Acceptance Criteria

1. WHEN the user navigates to the rubric upload page THEN the system SHALL display a file upload interface that accepts common document formats (PDF, DOCX, TXT)
2. WHEN the user selects a rubric file THEN the system SHALL validate the file format and size before allowing upload
3. WHEN a valid rubric file is uploaded THEN the system SHALL process and store the rubric content for use in grading
4. WHEN the upload is successful THEN the system SHALL display a confirmation message and show the uploaded rubric in the rubrics list

### Requirement 2

**User Story:** As an instructor, I want to manually create rubrics through a form interface, so that I can define grading criteria without needing to upload external files.

#### Acceptance Criteria

1. WHEN the user clicks "Create New Rubric" THEN the system SHALL display a form with fields for rubric title, description, and question entries
2. WHEN creating a question entry THEN the system SHALL require a question title, minimum score (float), and maximum score (float)
3. WHEN defining scoring criteria THEN the system SHALL allow adding optional score ranges with descriptions (e.g., "3 marks: excellent work", "1-2 marks: satisfactory", "0 marks: unsatisfactory")
4. WHEN the user saves a manually created rubric THEN the system SHALL validate score ranges and store the rubric structure

### Requirement 3

**User Story:** As an instructor, I want to view and manage all my uploaded rubrics, so that I can organize and maintain my grading standards effectively.

#### Acceptance Criteria

1. WHEN the user accesses the rubric upload page THEN the system SHALL display a list of all previously uploaded and created rubrics
2. WHEN viewing the rubrics list THEN the system SHALL show rubric name, creation date, total points, and number of criteria for each rubric
3. WHEN the user clicks on a rubric THEN the system SHALL display a detailed view with all criteria and point breakdowns
4. WHEN the user wants to edit a rubric THEN the system SHALL provide options to modify rubric details and criteria
5. WHEN the user wants to delete a rubric THEN the system SHALL prompt for confirmation before removing the rubric

### Requirement 4

**User Story:** As an instructor, I want to assign rubrics to specific courses and assignments, so that the correct grading criteria are applied to the appropriate student work.

#### Acceptance Criteria

1. WHEN creating or editing a rubric THEN the system SHALL provide options to associate the rubric with specific courses and assignments
2. WHEN a rubric is assigned to an assignment THEN the system SHALL make it available for use in the grading interface
3. WHEN viewing rubrics THEN the system SHALL display which courses and assignments each rubric is associated with
4. WHEN the user filters rubrics THEN the system SHALL allow filtering by course, assignment, or creation date

### Requirement 5

**User Story:** As a user, I want the rubric upload page to integrate seamlessly with the existing navigation, so that I can easily switch between grading and rubric management.

#### Acceptance Criteria

1. WHEN the user is on any page THEN the system SHALL show "Rubric Upload" as a navigation option in the sidebar
2. WHEN the user clicks on "Rubric Upload" in the navigation THEN the system SHALL navigate to the rubric upload page
3. WHEN on the rubric upload page THEN the system SHALL highlight "Rubric Upload" as the active navigation item
4. WHEN navigating between pages THEN the system SHALL maintain the same sidebar layout and user profile information