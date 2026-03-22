# Design Document

## Overview

The Lecture Notes RAG Integration feature extends the existing rubrics management system to support uploading and associating lecture notes and background materials with rubrics. These materials are automatically processed and integrated into the RAG (Retrieval-Augmented Generation) knowledge base, enabling the AI grader to reference course-specific content when evaluating student submissions. This enhancement improves grading accuracy by providing contextual information that helps the AI understand course concepts, terminology, and expectations.

## Architecture

### Component Integration
The feature integrates with existing components while adding new functionality:

```
RubricUploadPage (Enhanced)
├── LectureNotesSection (New)
│   ├── LectureNotesUpload
│   ├── LectureNotesList
│   └── LectureNotesAssociation
├── RubricMainContent (Enhanced)
│   ├── RubricUploadSection
│   ├── RubricListSection
│   └── RubricDetailModal (Enhanced with notes)
└── Backend Integration
    ├── LectureNotesService (New)
    ├── RAGIntegrationService (Enhanced)
    └── VectorStore (Enhanced)
```

### Data Flow
1. **Upload**: Instructor uploads lecture notes via enhanced UI
2. **Processing**: Backend extracts text content and generates embeddings
3. **Storage**: Notes stored in JSON with metadata and associations
4. **RAG Integration**: Content automatically added to vector store
5. **Grading**: AI references lecture notes during evaluation

## Components and Interfaces

### Frontend Components

#### LectureNotesSection Component
```typescript
interface LectureNotesSection {
  rubricId?: string;
  onNotesUploaded: (notes: LectureNote[]) => void;
  onAssociationChanged: (rubricId: string, noteIds: string[]) => void;
}

interface LectureNote {
  id: string;
  filename: string;
  originalName: string;
  fileSize: number;
  fileType: 'pdf' | 'docx' | 'txt' | 'md';
  uploadedAt: Date;
  processedAt?: Date;
  extractedContent?: string;
  wordCount?: number;
  associatedRubrics: string[];
  metadata: {
    pageCount?: number;
    processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
    processingError?: string;
  };
}
```

#### LectureNotesUpload Component
```typescript
interface LectureNotesUploadProps {
  onFileUpload: (file: File, associateWithRubric?: string) => Promise<void>;
  maxFileSize: number; // 50MB
  acceptedFormats: string[];
  disabled?: boolean;
}
```

#### LectureNotesList Component
```typescript
interface LectureNotesListProps {
  notes: LectureNote[];
  onView: (note: LectureNote) => void;
  onDelete: (noteId: string) => void;
  onAssociate: (noteId: string, rubricIds: string[]) => void;
  searchQuery?: string;
}
```

### Backend Services

#### LectureNotesService
```python
class LectureNotesService:
    def __init__(self, storage_path: str, rag_system: RAGGradingSystem):
        self.storage_path = storage_path
        self.rag_system = rag_system
        self.notes_data: Dict[str, LectureNote] = {}
    
    async def upload_lecture_note(
        self, 
        file_content: bytes, 
        filename: str, 
        associate_with_rubric: Optional[str] = None
    ) -> LectureNote:
        """Upload and process lecture note file"""
        
    async def associate_with_rubric(
        self, 
        note_id: str, 
        rubric_id: str
    ) -> bool:
        """Associate lecture note with rubric"""
        
    async def get_notes_for_rubric(self, rubric_id: str) -> List[LectureNote]:
        """Get all lecture notes associated with a rubric"""
        
    async def delete_lecture_note(self, note_id: str) -> bool:
        """Delete lecture note and remove from RAG"""
```

#### Enhanced RAG Integration
```python
class EnhancedRAGGradingSystem(RAGGradingSystem):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.lecture_notes_service = LectureNotesService(
            storage_path="src/data/lecture_notes.json",
            rag_system=self
        )
    
    async def add_lecture_note_to_rag(
        self, 
        note_content: str, 
        note_id: str, 
        rubric_ids: List[str]
    ) -> None:
        """Add lecture note content to vector store with rubric associations"""
        
    async def grade_answer_with_context(
        self, 
        request: GradingRequest
    ) -> GradingResponse:
        """Enhanced grading that includes lecture notes context"""
```

## Data Models

### Lecture Notes Storage
```typescript
interface LectureNotesStore {
  notes: Record<string, LectureNote>;
  rubricAssociations: Record<string, string[]>; // rubricId -> noteIds
  metadata: {
    version: string;
    lastUpdated: Date;
    totalNotes: number;
  };
}
```

### RAG Chunk Enhancement
```python
class EnhancedRubricChunk(RubricChunk):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.source_type: str = "rubric"  # "rubric" | "lecture_note"
        self.source_id: str = ""
        self.associated_rubrics: List[str] = []
```

### API Endpoints
```python
# New endpoints for lecture notes
@app.route('/api/lecture-notes/upload', methods=['POST'])
async def upload_lecture_note():
    """Upload lecture note file"""

@app.route('/api/lecture-notes/<note_id>/associate', methods=['POST'])
async def associate_note_with_rubric():
    """Associate note with rubric"""

@app.route('/api/lecture-notes/rubric/<rubric_id>', methods=['GET'])
async def get_notes_for_rubric():
    """Get notes associated with rubric"""

@app.route('/api/lecture-notes/<note_id>', methods=['DELETE'])
async def delete_lecture_note():
    """Delete lecture note"""

@app.route('/api/lecture-notes/search', methods=['POST'])
async def search_lecture_notes():
    """Search through lecture notes content"""
```

## Error Handling

### File Processing Errors
- **Large File Handling**: Implement chunked processing for files approaching 50MB limit
- **Format Validation**: Enhanced validation for academic document formats
- **Content Extraction Failures**: Graceful fallback with manual content input option
- **Encoding Issues**: Robust text encoding detection and conversion

### RAG Integration Errors
- **Vector Store Failures**: Retry mechanism with exponential backoff
- **Embedding Generation Errors**: Queue failed items for retry processing
- **Association Conflicts**: Validation to prevent circular or invalid associations
- **Context Retrieval Failures**: Fallback to rubric-only grading if lecture notes unavailable

### Storage and Sync Errors
- **JSON Corruption**: Backup and recovery mechanisms
- **Concurrent Access**: File locking and atomic operations
- **Disk Space**: Monitoring and cleanup of processed files
- **Network Failures**: Offline capability with sync when connection restored

## Testing Strategy

### Unit Tests
- LectureNotesService upload and processing logic
- RAG integration with lecture notes content
- File validation and content extraction
- Association management between notes and rubrics
- Search functionality across lecture notes

### Integration Tests
- End-to-end upload and association workflow
- Grading with lecture notes context integration
- File processing pipeline with various formats
- Error handling and recovery scenarios
- Performance with large files and multiple associations

### User Acceptance Tests
- Upload various academic document formats
- Associate notes with multiple rubrics
- Verify AI grading references lecture content
- Test search and management functionality
- Validate responsive design and accessibility

## UI/UX Design Patterns

### Enhanced Rubric Management Layout
```
┌─────────────────────────────────────────────────────────────┐
│ Rubric Management                                           │
├─────────────────────────────────────────────────────────────┤
│ [Upload] [Create] [Manage] [Lecture Notes] ← New Tab       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌─── Rubrics ────┐  ┌─── Lecture Notes ────┐              │
│ │ • Rubric A     │  │ • Course_Intro.pdf   │              │
│ │ • Rubric B     │  │ • Lecture_01.docx    │              │
│ │ • Rubric C     │  │ • Reading_List.txt   │              │
│ └────────────────┘  └──────────────────────┘              │
│                                                             │
│ ┌─── Associations ────────────────────────────────────────┐ │
│ │ Rubric A ←→ Course_Intro.pdf, Lecture_01.docx         │ │
│ │ Rubric B ←→ Lecture_01.docx, Reading_List.txt         │ │
│ └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Lecture Notes Upload Interface
- **Drag-and-Drop Zone**: Enhanced dropzone supporting academic formats
- **Batch Upload**: Support for multiple files with progress tracking
- **Immediate Association**: Option to associate with current rubric during upload
- **Preview Panel**: Quick content preview before processing
- **Processing Status**: Real-time feedback on extraction and RAG integration

### Association Management
- **Visual Connections**: Clear visual indicators of note-rubric relationships
- **Bulk Operations**: Select multiple notes for batch association/disassociation
- **Search Integration**: Filter notes by content, rubric association, or metadata
- **Quick Actions**: One-click association from rubric detail view

## Performance Considerations

### File Processing Optimization
- **Async Processing**: Non-blocking file upload and content extraction
- **Chunked Processing**: Handle large files without memory issues
- **Caching**: Cache extracted content to avoid reprocessing
- **Background Jobs**: Queue heavy processing tasks

### RAG Performance
- **Selective Context**: Only include relevant lecture notes in grading context
- **Embedding Caching**: Cache embeddings for frequently accessed content
- **Context Pruning**: Limit context size to maintain response quality
- **Parallel Processing**: Process multiple rubric associations concurrently

### Storage Efficiency
- **Content Deduplication**: Avoid storing duplicate content across notes
- **Compression**: Compress stored text content for large documents
- **Lazy Loading**: Load note content only when needed
- **Cleanup Jobs**: Remove orphaned files and unused embeddings

## Security and Privacy

### File Security
- **Virus Scanning**: Scan uploaded files for malware
- **Content Sanitization**: Remove potentially harmful content
- **Access Control**: Restrict access to uploaded materials by user/course
- **Audit Logging**: Track all file operations and associations

### Data Privacy
- **Content Encryption**: Encrypt stored lecture note content
- **Access Logs**: Monitor who accesses which materials
- **Retention Policies**: Automatic cleanup of old or unused materials
- **GDPR Compliance**: Support for data deletion and export requests

## Migration and Deployment

### Existing System Integration
- **Backward Compatibility**: Ensure existing rubrics continue to work
- **Gradual Rollout**: Feature flag for controlled deployment
- **Data Migration**: Scripts to handle existing rubric data
- **Performance Monitoring**: Track impact on existing grading performance

### Deployment Strategy
- **Database Schema**: Add lecture notes tables/collections
- **File Storage**: Set up secure file storage for uploaded materials
- **RAG System Update**: Deploy enhanced vector store capabilities
- **API Versioning**: Maintain compatibility with existing API clients