# Design Document

## Overview

The Rubric Upload Page will be a new React component that integrates with the existing AI Grader application. It will provide a comprehensive interface for uploading, creating, and managing grading rubrics. The page will follow the same design patterns and styling as the existing GradingPage component, maintaining visual consistency throughout the application.

## Architecture

### Component Structure
```
RubricUploadPage
├── RubricUploadHeader (top navigation bar)
├── RubricSidebar (existing sidebar with updated navigation)
├── RubricMainContent
│   ├── RubricUploadSection
│   │   ├── FileUploadDropzone
│   │   └── ManualRubricForm
│   ├── RubricListSection
│   │   ├── RubricFilters
│   │   ├── RubricGrid
│   │   └── RubricCard (individual rubric display)
│   └── RubricDetailModal (for viewing/editing rubrics)
```

### State Management
- Use React hooks pattern similar to `useGradingController`
- Create `useRubricController` hook to manage:
  - Rubric list state
  - Upload progress
  - Form validation
  - Modal states
  - Filter states

### Navigation Integration
- Update existing sidebar navigation to include "Rubric Upload" option
- Implement React Router for page navigation
- Maintain active state highlighting in sidebar

## Components and Interfaces

### RubricUploadPage Component
```typescript
interface RubricUploadPageProps {
  courseId?: string;
}

interface RubricData {
  id: string;
  title: string;
  description: string;
  questions: RubricQuestion[];
  totalMinPoints: number;
  totalMaxPoints: number;
  courseId?: string;
  assignmentId?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface RubricQuestion {
  id: string;
  title: string;
  description?: string;
  minScore: number; // float
  maxScore: number; // float
  scoringCriteria: ScoringCriterion[];
}

interface ScoringCriterion {
  id: string;
  scoreRange: string; // e.g., "3", "1-2", "0"
  description: string; // e.g., "Excellent analysis with clear examples"
  minPoints: number;
  maxPoints: number;
}

interface UploadedFile {
  id: string;
  filename: string;
  size: number;
  uploadDate: Date;
  processedContent?: string;
  rubricId?: string;
}
```

### FileUploadDropzone Component
- Drag-and-drop file upload interface
- File format validation (PDF, DOCX, TXT)
- File size validation (max 10MB)
- Upload progress indicator
- Error handling for invalid files

### ManualRubricForm Component
- Dynamic form for creating rubrics
- Add/remove criteria functionality
- Point value validation
- Real-time total points calculation
- Form validation with error messages

### RubricCard Component
```typescript
interface RubricCardProps {
  rubric: RubricData;
  onEdit: (rubric: RubricData) => void;
  onDelete: (rubricId: string) => void;
  onView: (rubric: RubricData) => void;
}
```

### RubricDetailModal Component
- Full rubric view with all criteria
- Edit mode for modifying rubrics
- Assignment association interface
- Delete confirmation dialog

## Data Models

### Data Models

### Rubric Storage
```typescript
interface RubricData {
  id: string;
  title: string;
  description: string;
  questions: RubricQuestion[];
  totalMinPoints: number;
  totalMaxPoints: number;
  courseId?: string;
  assignmentId?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface RubricQuestion {
  id: string;
  title: string;
  description?: string;
  minScore: number; // float
  maxScore: number; // float
  scoringCriteria: ScoringCriterion[];
}

interface ScoringCriterion {
  id: string;
  scoreRange: string; // e.g., "3", "1-2", "0"
  description: string; // e.g., "Excellent analysis with clear examples"
  minPoints: number;
  maxPoints: number;
}

interface RubricStore {
  rubrics: RubricData[];
  uploadedFiles: UploadedFile[];
  assignments: Assignment[];
  courses: Course[];
}
```

### API Endpoints
```typescript
interface RubricAPI {
  uploadRubricFile(file: File, courseId?: string): Promise<RubricData>;
  createRubric(rubricData: Partial<RubricData>): Promise<RubricData>;
  updateRubric(id: string, updates: Partial<RubricData>): Promise<RubricData>;
  deleteRubric(id: string): Promise<void>;
  getRubrics(courseId?: string): Promise<RubricData[]>;
  assignRubricToAssignment(rubricId: string, assignmentId: string): Promise<void>;
}
```

## Error Handling

### File Upload Errors
- Invalid file format: Display user-friendly error message
- File too large: Show size limit and suggest compression
- Network errors: Retry mechanism with exponential backoff
- Processing errors: Clear error messages with suggested actions

### Form Validation Errors
- Required field validation with inline error messages
- Point value validation (must be positive numbers)
- Duplicate criterion name validation
- Total points validation (reasonable limits)

### API Error Handling
- Network connectivity issues
- Server errors with retry options
- Authentication/authorization errors
- Data validation errors from backend

## Testing Strategy

### Unit Tests
- Component rendering tests for all major components
- Form validation logic testing
- File upload validation testing
- State management hook testing
- Utility function testing

### Integration Tests
- File upload flow end-to-end
- Rubric creation and editing workflows
- Navigation between pages
- API integration testing
- Error handling scenarios

### User Acceptance Tests
- Upload various file formats and sizes
- Create rubrics with different criteria configurations
- Navigate between grading and rubric pages
- Test responsive design on different screen sizes
- Accessibility testing with screen readers

## UI/UX Design Patterns

### Visual Consistency
- Use same color scheme as GradingPage (`#fafbff` background, `#cee5ff` headers)
- Maintain consistent button styles and spacing
- Use same card design patterns for rubric display
- Keep sidebar styling identical to existing navigation

### Layout Structure
- Three-column layout: Sidebar (306px) | Main Content (flex-1) | Optional Detail Panel
- Responsive design that collapses sidebar on smaller screens
- Consistent padding and spacing (p-4, p-6 patterns)
- Same shadow and border radius styles

### Interactive Elements
- Hover states for all clickable elements
- Loading states for file uploads and API calls
- Success/error toast notifications
- Smooth transitions for modal open/close
- Drag-and-drop visual feedback

### Accessibility
- Proper ARIA labels for all interactive elements
- Keyboard navigation support
- Screen reader compatible
- High contrast mode support
- Focus management for modals and forms