# Lecture Notes Components

This directory contains React components for managing lecture notes in the rubric management system.

## Components

### LectureNotesManagement (NEW - Unified Component)
A comprehensive, unified component that combines upload, list, association, and search functionality into a single responsive interface with built-in error handling and loading states.

**Features:**
- Tabbed navigation between Upload, List, Associate, and Search views
- Responsive layout that adapts to different screen sizes
- Global error and success message handling
- Statistics dashboard showing total notes, processing status, and rubrics
- Loading overlay for async operations
- Seamless integration of all lecture notes functionality

**Props:**
```typescript
interface LectureNotesManagementProps {
    notes: LectureNote[];
    rubrics: RubricData[];
    onFileUpload: (file: File, associateWithRubric?: string) => Promise<void>;
    onBatchUpload?: (files: File[], associateWithRubrics?: string[]) => Promise<void>;
    onFileRemove: (noteId: string) => Promise<void>;
    onAssociate: (noteIds: string[], rubricIds: string[]) => Promise<void>;
    onDisassociate: (noteIds: string[], rubricIds: string[]) => Promise<void>;
    loading?: boolean;
    className?: string;
}
```

**Usage:**
```typescript
<LectureNotesManagement
    notes={notes}
    rubrics={rubrics}
    onFileUpload={handleFileUpload}
    onBatchUpload={handleBatchUpload}
    onFileRemove={handleFileRemove}
    onAssociate={handleAssociate}
    onDisassociate={handleDisassociate}
    loading={loading}
/>
```

### LectureNotesList
Displays lecture notes in a responsive grid layout with file metadata and action buttons.

**Features:**
- Responsive grid layout (1 column on mobile, 2 on tablet, 3 on desktop)
- File metadata display (size, type, upload date, word count, page count)
- Processing status badges (pending, processing, completed, failed)
- Associated rubrics display
- Action buttons (view, associate, delete)
- Loading and empty states

**Props:**
```typescript
interface LectureNotesListProps {
    notes: LectureNote[];
    rubrics?: RubricData[];
    onView: (note: LectureNote) => void;
    onDelete: (noteId: string) => void;
    onAssociate: (noteId: string) => void;
    loading?: boolean;
    emptyMessage?: string;
    className?: string;
}
```

### LectureNotesSearch
Provides search and filtering capabilities for lecture notes.

**Features:**
- Text-based search across filename and content
- Filter by file type (PDF, DOCX, TXT, MD)
- Filter by rubric association
- Filter by upload date range
- Filter by processing status
- Active filter count display
- Clear all filters button

**Props:**
```typescript
interface LectureNotesSearchProps {
    notes: LectureNote[];
    rubrics?: RubricData[];
    onFilteredNotesChange: (filteredNotes: LectureNote[]) => void;
    className?: string;
}
```

### LectureNotesManager
Combined component that integrates search and list functionality.

**Features:**
- Automatic integration of search and list components
- Manages filtered state internally
- Simplified API for parent components

**Props:**
```typescript
interface LectureNotesManagerProps {
    notes: LectureNote[];
    rubrics?: RubricData[];
    onView: (note: LectureNote) => void;
    onDelete: (noteId: string) => void;
    onAssociate: (noteId: string) => void;
    loading?: boolean;
    className?: string;
}
```

### LectureNotesUpload
File upload component with drag-and-drop support and rubric association.

**Features:**
- Drag-and-drop file upload
- Multiple file format support (PDF, DOCX, TXT, MD)
- 50MB file size limit
- Batch upload with progress tracking
- Immediate rubric association
- Network status monitoring
- Error handling with retry mechanism

## Usage Example

```typescript
import React, { useState } from 'react';
import { LectureNotesManager, LectureNotesUpload } from './components/lecture-notes';
import { LectureNote, RubricData } from './types';

function LectureNotesPage() {
    const [notes, setNotes] = useState<LectureNote[]>([]);
    const [rubrics, setRubrics] = useState<RubricData[]>([]);
    const [loading, setLoading] = useState(false);

    const handleFileUpload = async (file: File, rubricId?: string) => {
        // Upload file to backend
        const formData = new FormData();
        formData.append('file', file);
        if (rubricId) {
            formData.append('rubricId', rubricId);
        }

        const response = await fetch('/api/lecture-notes/upload', {
            method: 'POST',
            body: formData
        });

        const newNote = await response.json();
        setNotes(prev => [...prev, newNote]);
    };

    const handleView = (note: LectureNote) => {
        // Open preview modal
        console.log('Viewing note:', note);
    };

    const handleDelete = async (noteId: string) => {
        await fetch(`/api/lecture-notes/${noteId}`, {
            method: 'DELETE'
        });
        setNotes(prev => prev.filter(n => n.id !== noteId));
    };

    const handleAssociate = (noteId: string) => {
        // Open association modal
        console.log('Associating note:', noteId);
    };

    return (
        <div className="space-y-6">
            <h1>Lecture Notes Management</h1>

            {/* Upload Section */}
            <LectureNotesUpload
                onFileUpload={handleFileUpload}
                availableRubrics={rubrics}
                maxFileSize={50}
                acceptedFormats={['.pdf', '.docx', '.txt', '.md']}
            />

            {/* Management Section */}
            <LectureNotesManager
                notes={notes}
                rubrics={rubrics}
                onView={handleView}
                onDelete={handleDelete}
                onAssociate={handleAssociate}
                loading={loading}
            />
        </div>
    );
}
```

## Styling

All components use Tailwind CSS for styling and are fully responsive. They integrate with the existing UI component library (Card, Button, Progress, etc.).

## Requirements Satisfied

- **Requirement 3.1**: List display with file names, upload dates, and associated rubrics
- **Requirement 3.2**: View, edit associations, and delete functionality
- **Requirement 5.1**: Content preview capability
- **Requirement 5.2**: Text-based search across materials
- **Requirement 5.3**: Search result highlighting and navigation
