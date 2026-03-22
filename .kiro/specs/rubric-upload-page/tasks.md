# Implementation Plan

- [x] 1. Set up routing and navigation infrastructure
  - Install and configure React Router for page navigation
  - Update App.tsx to include routing structure
  - Modify existing sidebar navigation to include Rubric Upload option
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 2. Create core data models and types
  - [x] 2.1 Define TypeScript interfaces for rubric data structures
    - Create RubricData, RubricQuestion, and ScoringCriterion interfaces
    - Define question-based structure with min/max scores (float)
    - Add scoring criteria with score ranges and descriptions
    - Define UploadedFile and API response types
    - _Requirements: 1.1, 2.1, 2.2, 2.3_

  - [x] 2.2 Create rubric service layer
    - Implement RubricService class with API methods
    - Add file upload handling utilities
    - Create rubric validation functions
    - _Requirements: 1.3, 2.3, 3.3_

- [x] 3. Implement rubric controller hook
  - [x] 3.1 Create useRubricController hook
    - Implement state management for rubrics list
    - Add file upload state and progress tracking
    - Create form state management for manual rubric creation
    - Handle modal states and UI interactions
    - _Requirements: 1.1, 2.1, 3.1_

  - [x] 3.2 Add rubric CRUD operations
    - Implement create, read, update, delete operations
    - Add file upload processing logic
    - Create rubric assignment functionality
    - Handle error states and loading states
    - _Requirements: 1.3, 2.3, 3.3, 4.2_

- [x] 4. Build file upload components
  - [x] 4.1 Create FileUploadDropzone component
    - Implement drag-and-drop file upload interface
    - Add file format and size validation
    - Create upload progress indicator
    - Handle upload errors with user feedback
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 4.2 Add file processing utilities
    - Create file validation functions
    - Implement file content extraction for supported formats
    - Add file preview functionality
    - _Requirements: 1.2, 1.3_

- [x] 5. Create manual rubric creation form
  - [x] 5.1 Build ManualRubricForm component
    - Create form with rubric title and description fields
    - Implement dynamic question entry system with add/remove functionality
    - Add min/max score inputs (float validation) for each question
    - Create scoring criteria builder with score ranges and descriptions
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 5.2 Create question and criteria management
    - Build dynamic question input components with title and score range
    - Add scoring criteria inputs (score range like "3", "1-2", "0" with descriptions)
    - Implement validation for score ranges and overlapping criteria
    - Add real-time total points calculation (min/max)
    - _Requirements: 2.2, 2.3, 2.4_

- [x] 6. Implement rubric display and management
  - [x] 6.1 Create RubricCard component
    - Build rubric summary card with key information
    - Add action buttons for view, edit, delete
    - Implement assignment association display
    - _Requirements: 3.1, 3.2, 4.3_

  - [x] 6.2 Build RubricGrid and filtering
    - Create responsive grid layout for rubric cards
    - Implement filtering by course, assignment, date
    - Add search functionality for rubric names
    - _Requirements: 3.1, 4.4_

- [x] 7. Create rubric detail and editing interface
  - [x] 7.1 Build RubricDetailModal component
    - Create detailed rubric view with all criteria
    - Implement edit mode with form validation
    - Add assignment association interface
    - Handle modal open/close states
    - _Requirements: 3.3, 3.4, 4.1, 4.2_

  - [x] 7.2 Add rubric deletion functionality
    - Implement delete confirmation dialog
    - Handle rubric deletion with proper cleanup
    - Update UI state after deletion
    - _Requirements: 3.5_

- [x] 8. Build main RubricUploadPage component
  - [x] 8.1 Create RubricUploadPage layout
    - Implement three-column layout matching existing design
    - Integrate all sub-components (upload, list, detail)
    - Add responsive design for different screen sizes
    - _Requirements: 5.1, 5.3_

  - [x] 8.2 Add page-level state management
    - Connect useRubricController hook to UI components
    - Implement loading and error states for the page
    - Add success/error notifications
    - _Requirements: 1.4, 2.3, 3.1_

- [x] 9. Integrate with existing navigation
  - [x] 9.1 Update sidebar navigation component
    - Add "Rubric Upload" navigation item
    - Implement active state highlighting
    - Maintain existing navigation functionality
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 9.2 Update App.tsx routing
    - Add route for rubric upload page
    - Ensure proper navigation between pages
    - Maintain user session state across navigation
    - _Requirements: 5.2, 5.4_

- [x] 10. Add error handling and validation
  - [x] 10.1 Implement comprehensive error handling
    - Add file upload error handling with user feedback
    - Create form validation with inline error messages
    - Handle API errors with retry mechanisms
    - _Requirements: 1.2, 2.2, 3.4_

  - [x] 10.2 Add loading states and user feedback
    - Implement loading spinners for async operations
    - Add success/error toast notifications
    - Create progress indicators for file uploads
    - _Requirements: 1.3, 1.4, 2.3_

- [x] 11. Integrate JSON storage persistence
  - [x] 11.1 Connect RubricService to JsonStorageService
    - Update RubricService to use JsonStorageService for data persistence
    - Ensure created and uploaded rubrics are saved to JSON file
    - Load existing rubrics from JSON file on initialization
    - _Requirements: 1.3, 2.3, 3.1_

  - [x] 11.2 Update rubric controller to use persistent storage
    - Modify useRubricController to initialize from JSON storage
    - Ensure all CRUD operations persist to JSON file
    - Handle storage errors gracefully
    - _Requirements: 3.1, 3.3, 3.4, 3.5_

- [x] 12. Implement view and edit functionality
  - [x] 12.1 Add view rubric functionality
    - Create ViewRubricView component to display rubric in read-only format
    - Show all rubric details including questions and scoring criteria
    - Add navigation back to manage view and edit mode
    - _Requirements: 3.3, 3.4_

  - [x] 12.2 Add edit rubric functionality
    - Create EditRubricView component reusing create form layout
    - Pre-populate form with existing rubric data
    - Implement update functionality with validation
    - Save changes to JSON storage and refresh manage view
    - _Requirements: 3.4, 3.5_

- [ ]* 12. Write comprehensive tests
  - [ ]* 12.1 Create unit tests for components
    - Test RubricUploadPage component rendering
    - Test FileUploadDropzone functionality
    - Test ManualRubricForm validation
    - Test RubricCard interactions
    - _Requirements: All requirements_

  - [ ]* 12.2 Add integration tests
    - Test file upload workflow end-to-end
    - Test rubric creation and editing flows
    - Test navigation between pages
    - Test error handling scenarios
    - _Requirements: All requirements_