# Rubric File Upload Components

This directory contains components and utilities for handling file uploads in the rubric management system.

## Components

### FileUploadDropzone

A drag-and-drop file upload component with validation and progress tracking.

**Features:**
- Drag and drop file upload interface
- File format validation (PDF, DOCX, TXT)
- File size validation (configurable limits)
- Upload progress indicators
- Error handling with user feedback
- Support for multiple file uploads
- File removal functionality

**Usage:**
```tsx
import { FileUploadDropzone } from './components/rubric/FileUploadDropzone';

<FileUploadDropzone
  onFileUpload={handleFileUpload}
  onFileRemove={handleFileRemove}
  uploadedFiles={uploadedFiles}
  maxFileSize={10} // 10MB
  acceptedFormats={['.pdf', '.docx', '.txt']}
  disabled={false}
/>
```

### FilePreview

Components for previewing uploaded files with metadata display.

**Components:**
- `FilePreview`: Full preview modal with file content and metadata
- `FilePreviewCard`: Compact preview card for file lists

**Features:**
- File content preview (text files)
- File metadata display (size, type, modification date)
- Word count for text files
- File type badges and icons
- Download and remove actions

**Usage:**
```tsx
import { FilePreview, FilePreviewCard } from './components/rubric/FilePreview';

// Full preview
<FilePreview
  file={selectedFile}
  onClose={handleClose}
  onDownload={handleDownload}
/>

// Compact card
<FilePreviewCard
  file={file}
  onPreview={handlePreview}
  onRemove={handleRemove}
/>
```

## Utilities

### File Processing Utilities

Located in `src/utils/fileProcessing.ts`, these utilities provide:

**File Validation:**
- Format validation (PDF, DOCX, TXT)
- Size validation (configurable limits)
- MIME type checking
- Filename validation
- Multiple file validation

**Content Extraction:**
- Text file content extraction ✅
- PDF text extraction using PDF.js ✅
- DOCX text extraction using mammoth.js ✅
- Metadata extraction (word count, character count, page count) ✅

**File Preview Generation:**
- Text file preview (first 5 lines) ✅
- PDF content preview (first 5 lines of extracted text) ✅
- DOCX content preview (first 5 lines of extracted text) ✅
- File metadata collection ✅
- Preview support detection ✅

**Utility Functions:**
- File size formatting
- Filename sanitization
- File type icon mapping

**Usage:**
```tsx
import {
  validateFile,
  extractFileContent,
  generateFilePreview,
  formatFileSize
} from './utils/fileProcessing';

// Validate a file
const validation = validateFile(file);
if (validation.isValid) {
  // Process file
}

// Extract content
const content = await extractFileContent(file);
if (content.success) {
  console.log(content.content);
}

// Generate preview
const preview = await generateFilePreview(file);
```

## Supported File Formats

- **PDF** (.pdf): Up to 10MB
- **DOCX** (.docx): Up to 10MB  
- **TXT** (.txt): Up to 5MB

## Configuration

File format support and size limits can be configured in `SUPPORTED_FILE_FORMATS` in `fileProcessing.ts`:

```typescript
export const SUPPORTED_FILE_FORMATS = {
  pdf: {
    extensions: ['.pdf'],
    mimeTypes: ['application/pdf'],
    maxSize: 10 * 1024 * 1024, // 10MB
  },
  // ... other formats
};
```

## Dependencies

- `react-dropzone`: For drag-and-drop functionality
- `pdfjs-dist`: For PDF text extraction
- `mammoth`: For DOCX text extraction
- `lucide-react`: For icons
- UI components from `../ui/` directory

## Future Enhancements

- Image file support (JPG, PNG)
- Batch file operations
- File compression
- Cloud storage integration
- OCR for scanned PDFs
- Advanced DOCX formatting preservation