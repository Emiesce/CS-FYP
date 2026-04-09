# AI Essay Grading System

An AI-powered essay grading system with rubric management, lecture notes RAG integration, and Azure OpenAI-based grading.

## Overview

This project consists of two independently running services:

| Service | Technology | Port | Purpose |
|---------|-----------|------|---------|
| Frontend | React + TypeScript (Vite) | 3000/3001 | User interface |
| Grading API | Python Flask | 5000 | Rubric CRUD, lecture notes, AI grading |

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

# Python backend
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Required environment variables:
```
OPENAI_API_KEY=your_azure_openai_key
AZURE_OPENAI_ENDPOINT=https://your-endpoint.azure-api.net
AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini
AZURE_EMBEDDING_DEPLOYMENT=text-embedding-ada-002
```

### 3. Start Services

```bash
# Terminal 1 - Grading API (port 5000)
python grading_api.py

# Terminal 2 - Frontend
npm run dev
```

Or use the combined dev script:
```bash
npm run dev:all
```

Open `http://localhost:3000` in your browser.

---

## Project Structure

```
project/
├── src/                              # Frontend (React/TypeScript)
│   ├── components/
│   │   ├── RubricUploadPage.tsx      # Main rubric management page
│   │   ├── Sidebar.tsx               # Navigation
│   │   ├── rubric/                   # Rubric-specific components
│   │   │   ├── LectureNotesSection.tsx   # Upload notes in create/edit
│   │   │   ├── LectureNotesDisplay.tsx   # View/download notes
│   │   │   ├── RubricGrid.tsx            # Rubric card grid
│   │   │   └── FileUploadDropzone.tsx    # Drag-and-drop upload
│   │   ├── lecture-notes/            # Standalone lecture notes components
│   │   └── ui/                       # Shared UI primitives
│   ├── hooks/
│   │   └── useRubricController.ts    # Rubric state management
│   ├── services/
│   │   └── RubricService.ts          # Rubric CRUD + storage
│   ├── utils/
│   │   ├── fileStorage.ts            # Lecture note file storage
│   │   └── jsonStorage.ts            # Rubric JSON persistence
│   ├── types/
│   │   └── index.ts                  # TypeScript interfaces
│   └── data/
│       ├── rubrics.json              # Persistent rubric storage
│       └── lecture_notes.json        # Lecture note metadata
│
├── src/ (Python)                     # Backend grading engine
│   ├── models/grading_models.py      # Data classes
│   ├── interfaces/                   # Abstract base classes
│   ├── implementations/
│   │   ├── azure_ai_client.py        # Azure OpenAI
│   │   ├── chroma_vector_store.py    # ChromaDB vector store
│   │   ├── production_grading_service.py  # Real grading logic
│   │   └── mock_implementations.py   # In-memory mocks for testing
│   ├── services/
│   │   ├── lecture_notes_service.py  # Upload, extract, RAG index
│   │   └── lecture_notes_validator.py
│   └── utils/
│       └── lecture_notes_storage.py  # lecture_notes.json persistence
│
├── grading_api.py                    # Flask API — port 5000
├── uploads/
│   └── lecture-notes/                # Uploaded PDF binaries stored here
└── data/
    └── chroma_db/                    # ChromaDB persistent vector store
```

---

## Architecture

```
User Browser
    │
    ▼
React App (port 3000)
    │
    ├── Rubric CRUD ──────────────► POST /rubrics
    │                               GET  /rubrics
    │
    ├── Lecture note upload ──────► POST /api/lecture-notes/upload
    │                                    ├── saves binary → uploads/lecture-notes/
    │                                    ├── extracts text (pdfplumber/PyMuPDF)
    │                                    └── indexes chunks → ChromaDB
    │
    ├── Lecture note download ────► GET /api/lecture-notes/download/{id}
    │                                    └── serves binary from uploads/lecture-notes/
    │
    └── Essay grading ───────────► POST /grade-answer
                                        ├── similarity_search(rubric_id)
                                        │       └── ChromaDB: rubric chunks + lecture note chunks
                                        └── AzureAIClient.grade_essay(essay, rubric_ctx, notes_ctx)
                                                └── Azure OpenAI GPT-4o-mini
```

---

## Key Flows

### Lecture Notes → RAG Pipeline

1. User uploads PDF in Edit Rubric view
2. `LectureNotesSection` → `FileStorageService.storeFile()` → `POST /api/lecture-notes/upload`
3. Backend saves binary to `uploads/lecture-notes/{uuid}_{filename}`
4. `LectureNotesService` extracts text (pdfplumber → PyMuPDF → PyPDF2 fallback chain)
5. `ProductionGradingService.add_lecture_note_to_rag()` chunks text by paragraph
6. Each chunk → `AzureAIClient.generate_embedding()` → upserted into ChromaDB with `associated_rubrics=[rubric_id]`
7. Note `backendId` (UUID) stored in rubric's `lectureNotes[]` array → saved to `rubrics.json`

### Grading with Lecture Notes Context

1. Student answer submitted → `POST /grade-answer`
2. `grade_essay_by_criterion(essay, criterion_id, rubric_id)`
3. `ChromaDB.similarity_search_with_rubric_context(query, rubric_id)` — filters by `associated_rubrics`
4. Returns rubric chunks + semantically relevant lecture note chunks
5. Both passed to Azure OpenAI as separate context fields
6. Score + justification returned per criterion

### Rubric Deletion Cascade

When a rubric is deleted:
1. `RubricService.deleteRubric()` loops through `rubric.lectureNotes[]`
2. Calls `DELETE /api/lecture-notes/{backendId}` for each note
3. Backend removes from `lecture_notes.json` and ChromaDB
4. Rubric removed from `rubrics.json`

---

## Data Storage

| Data | Location | Managed by |
|------|----------|------------|
| Rubric metadata + lecture note refs | `src/data/rubrics.json` | `JsonStorageService` (TS) |
| Lecture note metadata + extracted text | `src/data/lecture_notes.json` | `LectureNotesStorage` (Python) |
| Lecture note binary files | `uploads/lecture-notes/` | `grading_api.py` |
| Vector embeddings | `data/chroma_db/` | `ChromaVectorStore` (Python) |

### Rubric data shape

```json
{
  "id": "rubric-1",
  "title": "...",
  "questions": [...],
  "lectureNotes": [
    {
      "id": "note-xxx",
      "backendId": "uuid-from-backend",
      "originalName": "lecture.pdf",
      "fileSize": 840674,
      "fileType": "pdf"
    }
  ]
}
```

---

## API Reference

### Grading API (port 5000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/rubrics` | Save rubrics to JSON |
| POST | `/grade-answer` | Grade a student answer |
| POST | `/api/lecture-notes/upload` | Upload + extract + RAG index a file |
| GET | `/api/lecture-notes` | List all lecture notes |
| GET | `/api/lecture-notes/download/{id}` | Download original file binary |
| GET | `/api/lecture-notes/{id}/preview` | Get extracted text preview (JSON) |
| DELETE | `/api/lecture-notes/{id}` | Delete note + ChromaDB chunks |

---

## TypeScript Types

```typescript
interface LectureNote {
  id: string;           // frontend-generated ID
  backendId?: string;   // backend UUID — used for file retrieval
  filename: string;
  originalName: string;
  fileSize: number;
  fileType: 'pdf' | 'docx' | 'txt' | 'md';
  uploadedAt: Date;
  associatedRubrics: string[];
  metadata: { processingStatus: string };
}

interface RubricData {
  id: string;
  title: string;
  description: string;
  questions: RubricQuestion[];
  totalMinPoints: number;
  totalMaxPoints: number;
  lectureNotes: LectureNote[];
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Testing

```bash
# Frontend component tests
npx vitest --run

# Python backend tests
python test_grading_system.py
python test_grading_api.py
```

---

## Configuration

### `src/config/settings.py`
- Model configuration, storage paths

### `src/utils/fileStorage.ts`
- `GRADING_API` — backend URL (default: `http://localhost:5000`)

### `src/utils/jsonStorage.ts`
- Rubric persistence — tries backend first, falls back to localStorage

---

## Allowed File Types

Lecture notes: `.pdf`, `.docx`, `.txt`, `.md` — max 50MB per file

---

## Notes

- ChromaDB persists to `data/chroma_db/` and survives server restarts
- Rubric data persists to `src/data/rubrics.json` via the `/rubrics` POST endpoint
- Lecture note binaries persist to `uploads/lecture-notes/` — files uploaded before this folder existed need to be re-uploaded
- The `src/components/lecture-notes/` components are a standalone management UI built for the RAG spec, not yet wired into the main navigation
