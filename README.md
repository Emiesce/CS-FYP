# AI Essay Grading System

An AI-powered essay grading system with rubric management, lecture notes integration, and Azure OpenAI-based grading.

## Overview

This project consists of three independently running services:

| Service | Technology | Port | Purpose |
|---------|-----------|------|---------|
| Frontend | React + TypeScript (Vite) | 5173 | User interface |
| Grading API | Python Flask | 5000 | Rubric CRUD + AI essay grading |
| File Storage API | Python Flask | 5001 | Lecture notes file upload/download |

---

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.9+
- Azure OpenAI API key

### 1. Install Dependencies

```bash
# Frontend
npm install

# Python backends
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
# Copy and fill in your Azure credentials
cp .env.example .env
```

Required environment variables:
```
OPENAI_API_KEY=your_azure_openai_key
AZURE_OPENAI_ENDPOINT=https://your-endpoint.azure-api.net
AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini
AZURE_EMBEDDING_DEPLOYMENT=text-embedding-ada-002
```

### 3. Start All Services (3 terminals)

```bash
# Terminal 1 - Grading API
python grading_api.py

# Terminal 2 - File Storage API
python lecture_notes_file_api.py
# or on Windows: start-lecture-notes-api.bat

# Terminal 3 - Frontend
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Project Structure

```
project/
├── src/                          # Frontend (React/TypeScript)
│   ├── components/               # UI components
│   │   ├── RubricUploadPage.tsx  # Main rubric management page
│   │   ├── GradingPage.tsx       # Essay grading page
│   │   ├── Sidebar.tsx           # Navigation
│   │   ├── rubric/               # Rubric-specific components
│   │   ├── lecture-notes/        # Lecture notes components
│   │   └── ui/                   # Shared UI primitives
│   ├── hooks/
│   │   └── useRubricController.ts # Rubric state management
│   ├── utils/
│   │   ├── fileStorage.ts        # Lecture note file storage service
│   │   ├── jsonStorage.ts        # Rubric data storage service
│   │   └── fileProcessing.ts     # Rubric file parser (PDF/JSON)
│   ├── types/
│   │   └── index.ts              # TypeScript interfaces
│   ├── data/
│   │   └── rubrics.json          # Persistent rubric storage
│   ├── App.tsx
│   └── main.tsx
│
├── src/ (Python)                 # Backend grading engine
│   ├── models/
│   │   └── grading_models.py     # Data classes (GradingCriterion, MarkingScheme, etc.)
│   ├── interfaces/
│   │   ├── ai_client.py          # AIClient abstract base class
│   │   ├── grading_service.py    # GradingService abstract base class
│   │   └── vector_store.py       # VectorStore abstract base class
│   ├── implementations/
│   │   ├── azure_ai_client.py    # Azure OpenAI implementation
│   │   └── mock_implementations.py # In-memory mock for testing
│   ├── services/
│   │   ├── lecture_notes_service.py   # Lecture notes business logic
│   │   └── lecture_notes_validator.py # File validation
│   ├── config/
│   │   └── settings.py           # App configuration
│   ├── errors/
│   │   └── grading_errors.py     # Custom exceptions
│   └── grading_system.py         # Main orchestrator
│
├── grading_api.py                # Flask API - port 5000
├── lecture_notes_file_api.py     # Flask API - port 5001
├── uploads/
│   └── lecture-notes/            # Uploaded PDF files stored here
│
└── tests (root level)
    ├── test_grading_system.py
    ├── test_grading_api.py
    ├── test_lecture_notes_api.py
    ├── test_file_storage_api.py
    └── ...
```

---

## Architecture

### System Overview

```
User Browser
    │
    ▼
React App (port 5173)
    ├── Rubric management ──────► grading_api.py (port 5000)
    │                                   │
    │                             GradingSystem
    │                                   │
    │                             AzureAIClient ──► Azure OpenAI
    │                                   │
    │                             VectorStore (in-memory)
    │
    └── File upload/download ───► lecture_notes_file_api.py (port 5001)
                                        │
                                  uploads/lecture-notes/ (disk)
```

### Python Backend — Clean Architecture

The grading engine follows a clean architecture pattern with three layers:

**Interfaces** (contracts) → **Implementations** (concrete classes) → **Orchestrator** (wires it together)

```
interfaces/ai_client.py          ← defines: generate_embedding(), grade_essay()
    ↑ implemented by
implementations/azure_ai_client.py   ← real Azure OpenAI calls
implementations/mock_implementations.py  ← in-memory mock for tests

interfaces/vector_store.py       ← defines: add_documents(), similarity_search()
    ↑ implemented by
implementations/mock_implementations.py  ← MockVectorStore

interfaces/grading_service.py    ← defines: grade_essay_all_criteria(), etc.
    ↑ implemented by
implementations/mock_implementations.py  ← MockGradingService

grading_system.py                ← wires all implementations together
```

---

## Key Call Flows

### Creating a Rubric with Lecture Notes

```
User fills form + uploads PDF
    → CreateRubricView (RubricUploadPage.tsx)
        → LectureNotesSection: FileStorageService.storeFile()
            → POST http://localhost:5001/api/lecture-notes/upload
                → saves to uploads/lecture-notes/
        → handleSubmit()
            → useRubricController.createRubric()
                → POST http://localhost:5000/rubrics
                    → saves to src/data/rubrics.json
```

### Grading an Essay

```
User submits essay on GradingPage
    → POST http://localhost:5000/grade
        → GradingSystem.grade_essay(essay, rubric_id)
            → GradingService.grade_essay_all_criteria(request)
                → for each criterion:
                    → VectorStore.similarity_search_with_rubric_context()
                        → returns rubric chunks + lecture note chunks
                    → AIClient.grade_essay(essay, context, lecture_notes)
                        → Azure OpenAI GPT-4o-mini
                        → returns score + justification
                → returns EssayGradingResponse
```

### Viewing/Downloading a Lecture Note

```
User clicks View/Download on ViewRubricView
    → LectureNotesDisplay: FileStorageService.getFile(noteId)
        → checks backend: GET http://localhost:5001/api/lecture-notes/exists/{noteId}
            → if found: returns http://localhost:5001/api/lecture-notes/view/{noteId}
            → if not found: falls back to localStorage base64
        → opens file in new tab or triggers download
```

---

## Frontend Components

### Rubric Management (`src/components/rubric/`)

| Component | Purpose |
|-----------|---------|
| `FileUploadDropzone.tsx` | Drag-and-drop upload for rubric JSON/PDF files |
| `LectureNotesSection.tsx` | Upload lecture notes when creating/editing a rubric |
| `LectureNotesDisplay.tsx` | View and download lecture notes on the rubric detail page |
| `RubricAssociatedNotes.tsx` | Shows which notes are linked to a rubric |
| `RubricWithLectureNotes.tsx` | Combined rubric + notes view wrapper |

### Lecture Notes Management (`src/components/lecture-notes/`)

A standalone lecture notes management system (built for the RAG spec, not yet fully wired into the main app):

| Component | Purpose |
|-----------|---------|
| `LectureNotesUpload.tsx` | Standalone upload UI |
| `LectureNotesList.tsx` | List all uploaded notes |
| `LectureNotesSearch.tsx` | Search through notes |
| `LectureNotesAssociation.tsx` | Link notes to rubrics |
| `LectureNotesManagement.tsx` | Full management dashboard |
| `LectureNotesPreview.tsx` | Preview note content |
| `ProcessingStatusCard.tsx` | Shows processing status |

---

## API Reference

### Grading API (port 5000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/rubrics` | List all rubrics |
| POST | `/rubrics` | Save rubrics |
| POST | `/grade` | Grade an essay |
| GET | `/health` | Health check |

### File Storage API (port 5001)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/lecture-notes/health` | Health check |
| POST | `/api/lecture-notes/upload` | Upload a file |
| GET | `/api/lecture-notes/view/{noteId}` | View file inline |
| GET | `/api/lecture-notes/download/{noteId}` | Download file |
| DELETE | `/api/lecture-notes/delete/{noteId}` | Delete file |
| GET | `/api/lecture-notes/exists/{noteId}` | Check if file exists |

---

## Data Models

### TypeScript (Frontend)

```typescript
RubricData {
  id, title, description,
  questions: RubricQuestion[],
  totalMinPoints, totalMaxPoints,
  lectureNotes?: LectureNote[]
}

RubricQuestion {
  id, title, description,
  minScore, maxScore,
  scoringCriteria: ScoringCriterion[]
}

LectureNote {
  id, filename, originalName,
  fileSize, fileType,
  uploadedAt, associatedRubrics[]
}
```

### Python (Backend)

```python
GradingCriterion   # score + justification for one criterion
MarkingScheme      # full rubric with all criteria
RubricChunk        # text chunk stored in vector DB
EssayGradingRequest  # input: essay + rubric ID
EssayGradingResponse # output: all scores + overall feedback
```

---

## File Storage

Lecture note files are stored in two places depending on availability:

- **Primary**: `uploads/lecture-notes/` on the server (requires File Storage API running)
- **Fallback**: Browser `localStorage` as base64 (automatic if API is unavailable)

File naming convention: `{noteId}_{original_filename}` (e.g. `note-123456_lecture5.pdf`)

---

## Testing

```bash
# Test the grading system end-to-end
python test_grading_system.py

# Test the grading API endpoints
python test_grading_api.py

# Test file storage API
python test_file_storage_api.py

# Test lecture notes API
python test_lecture_notes_api.py

# Test Azure connection directly
python direct_azure_test.py

# Frontend component tests
npx vitest --run
```

---

## Configuration

### `src/config/settings.py`
- Default test criteria
- Model configuration defaults
- Storage paths

### `src/utils/fileStorage.ts`
- `API_BASE_URL` — file storage API endpoint (default: `http://localhost:5001`)
- `MAX_FILE_SIZE` — 50MB limit

### `src/utils/jsonStorage.ts`
- `RUBRICS_FILE_PATH` — rubric data file path
- Backend URL for rubric persistence (default: `http://localhost:5000`)

---

## Allowed File Types

Lecture notes accept: `.pdf`, `.docx`, `.txt`, `.md`  
Max file size: 50MB per file

---

## Notes

- The `src/components/lecture-notes/` components are built but not yet fully integrated into the main app navigation — they were developed as part of the RAG spec.
- The vector store is currently in-memory only. Restarting the grading API clears all indexed content. For production, replace `MockVectorStore` with a persistent store (e.g. Chroma, Pinecone, Azure AI Search).
- The grading API uses `MockGradingService` by default. To use real Azure OpenAI grading, ensure your `.env` is configured and switch to `AzureAIClient` in `grading_system.py`.
