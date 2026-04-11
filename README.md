# AI Essay Grading System

An AI-powered essay grading system with rubric management, lecture notes RAG integration, and Azure OpenAI-based grading.

## Overview

Two independently running services:

| Service | Technology | Port | Purpose |
|---------|-----------|------|---------|
| Frontend | React + TypeScript (Vite) | 3000 | Rubric management, student answers, grading results UI |
| Grading API | Python Flask | 5000 | AI grading, lecture notes, rubric storage |

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
# Terminal 1 — Grading API (port 5000)
python grading_api.py

# Terminal 2 — Frontend
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
├── grading_api.py                    # Flask API — port 5000
│
├── src/                              # Frontend (React/TypeScript)
│   ├── pages/
│   │   ├── DashboardPage.tsx         # Home / overview
│   │   ├── StudentAnswersPage.tsx    # Upload answers + run batch grading
│   │   └── GradingResultsPage.tsx    # Review AI scores, override manually
│   ├── components/
│   │   ├── RubricUploadPage.tsx      # Rubric create/edit with criteria hierarchy
│   │   ├── Sidebar.tsx               # Navigation
│   │   ├── rubric/
│   │   │   ├── RubricGrid.tsx            # Rubric card grid
│   │   │   ├── RubricCard.tsx            # Individual rubric card
│   │   │   ├── LectureNotesSection.tsx   # Upload notes in create/edit view
│   │   │   ├── LectureNotesDisplay.tsx   # View/download attached notes
│   │   │   └── RubricAssociatedNotes.tsx # Notes list on rubric
│   │   ├── lecture-notes/            # Standalone lecture notes management UI
│   │   │   ├── LectureNotesUpload.tsx
│   │   │   ├── LectureNotesList.tsx
│   │   │   ├── LectureNotesSearch.tsx
│   │   │   ├── LectureNotesAssociation.tsx
│   │   │   ├── LectureNotesPreview.tsx
│   │   │   ├── LectureNotesManagement.tsx
│   │   │   └── ProcessingStatusCard.tsx
│   │   └── ui/                       # shadcn/ui primitives
│   ├── hooks/
│   │   └── useRubricController.ts    # Rubric CRUD state management
│   ├── services/
│   │   └── RubricService.ts          # Rubric CRUD + storage
│   ├── utils/
│   │   └── jsonStorage.ts            # Rubric JSON persistence (backend + localStorage fallback)
│   ├── types/
│   │   └── index.ts                  # TypeScript interfaces
│   └── data/
│       ├── rubrics.json              # Persistent rubric storage
│       ├── lecture_notes.json        # Lecture note metadata
│       └── grading_results.json      # Grading results storage
│
├── src/ (Python backend)
│   ├── grading_system.py             # RAGGradingSystem orchestrator + factory functions
│   ├── models/
│   │   └── grading_models.py         # Pydantic data models (GradingRequest, GradingResponse, etc.)
│   ├── interfaces/
│   │   ├── ai_client.py              # AIClient abstract base
│   │   ├── vector_store.py           # VectorStore abstract base
│   │   └── grading_service.py        # GradingService abstract base
│   ├── implementations/
│   │   ├── azure_ai_client.py        # Azure OpenAI (GPT-4o-mini + text-embedding-ada-002)
│   │   ├── chroma_vector_store.py    # ChromaDB persistent vector store
│   │   └── production_grading_service.py  # Production grading orchestration
│   ├── services/
│   │   ├── lecture_notes_service.py  # Upload, text extraction, RAG indexing
│   │   └── lecture_notes_validator.py
│   ├── config/
│   │   └── settings.py               # Model config, storage paths, prompt templates
│   ├── errors/
│   │   └── grading_errors.py         # Custom exception types
│   └── utils/
│       ├── grading_storage.py        # JSON storage + exam format converter
│       └── lecture_notes_storage.py  # lecture_notes.json persistence
│
├── data/
│   └── chroma_db/                    # ChromaDB persistent vector store
└── uploads/
    └── lecture-notes/                # Uploaded PDF/DOCX binaries
```

---

## Features

### Rubric Management
- Create rubrics with multiple questions, each with named criteria and score levels
- Criteria hierarchy: question → criteria → score levels (with min/max points per band)
- Attach lecture notes (PDF, DOCX, TXT, MD) to rubrics for RAG-enhanced grading
- Edit, duplicate, and delete rubrics with cascade cleanup of associated notes

### Student Answer Grading
- Upload student answers as JSON (`{ studentId, answers: [{ questionId, answerText }] }`)
- Batch grade all students concurrently (rate-limited to 55 RPM)
- Per-question grading: each question's answer is graded against its own criteria
- One GPT call per question (grades all criteria for that question together)
- Scores snapped to 0.5 increments; letter grade assigned automatically

### Grading Results Review
- Browse results by student, navigate questions with tabs
- See AI-suggested score + justification + highlighted text per criterion
- Override scores manually; recalculates totals and letter grade
- Show/hide student identity toggle
- Per-question score shown alongside overall total

### Lecture Notes RAG
- Upload PDF/DOCX/TXT/MD files (up to 50MB)
- Text extracted via pdfplumber → PyMuPDF → PyPDF2 fallback chain
- Content chunked by paragraph and indexed into ChromaDB with rubric associations
- During grading, semantically relevant lecture note chunks are retrieved and injected into the GPT prompt as additional context

---

## Architecture

```
User Browser
    │
    ▼
React App (port 3000)
    │
    ├── Rubric CRUD ──────────────► POST /rubrics
    │
    ├── Lecture note upload ──────► POST /api/lecture-notes/upload
    │                                    ├── saves binary → uploads/lecture-notes/
    │                                    ├── extracts text (pdfplumber/PyMuPDF)
    │                                    └── indexes chunks → ChromaDB
    │
    ├── Student answers ──────────► POST /grade-batch
    │                                    ├── loads rubric from rubrics.json
    │                                    ├── converts to MarkingScheme (flat criteria list)
    │                                    ├── groups criteria by question_id
    │                                    ├── per question: similarity_search(ChromaDB)
    │                                    └── AzureAIClient.grade_essay_multi_criteria()
    │                                              └── Azure OpenAI GPT-4o-mini
    │
    └── Results review ───────────► GET /grading-results
                                    PUT /grading-results/update  (manual score override)
```

### Grading Pipeline Detail

1. Frontend sends `POST /grade-batch` with `{ question_answers: { q1: "...", q2: "..." }, marking_scheme_id }`
2. `RAGGradingSystem` loads rubric from `rubrics.json`, converts to flat `MarkingScheme.criteria[]` (each criterion tagged with `question_id`)
3. `ProductionGradingService` re-groups criteria by `question_id`
4. For each question group: ChromaDB similarity search retrieves rubric chunks + lecture note chunks
5. If 1 criterion → single GPT call; if multiple → one multi-criteria GPT call returning a JSON array
6. Results assembled into `questions[].criteria[]` structure and saved to `grading_results.json`

---

## API Reference

### Grading (port 5000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/grade-answer` | Grade a single student submission |
| POST | `/grade-batch` | Grade multiple students concurrently |
| GET | `/grading-results` | List all grading results |
| GET | `/grading-results/<student_id>` | Results for a specific student |
| PUT | `/grading-results/update` | Apply manual score overrides |
| GET | `/available-rubrics` | List rubrics from rubrics.json |
| GET | `/debug-rubric/<rubric_id>` | Inspect criteria generated for a rubric |

### Lecture Notes (port 5000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/lecture-notes/upload` | Upload + extract + RAG index a file |
| GET | `/api/lecture-notes` | List all lecture notes (filter by `?rubric_id=`) |
| GET | `/api/lecture-notes/download/<id>` | Download original file binary |
| DELETE | `/api/lecture-notes/<id>` | Delete note + remove ChromaDB chunks |

---

## Data Storage

| Data | Location | Managed by |
|------|----------|------------|
| Rubric definitions | `src/data/rubrics.json` | `JsonStorageService` (TS) |
| Lecture note metadata | `src/data/lecture_notes.json` | `LectureNotesStorage` (Python) |
| Grading results | `src/data/grading_results.json` | `GradingResultsStorage` (Python) |
| Lecture note binaries | `uploads/lecture-notes/` | `grading_api.py` |
| Vector embeddings | `data/chroma_db/` | `ChromaVectorStore` (Python) |

### Grading result shape

```json
{
  "data": {
    "studentID": "20841234",
    "studentName": "John Smith",
    "examId": "rubric-1",
    "questions": [
      {
        "questionId": "q1",
        "questionText": "Explain planning fallacy",
        "studentAnswer": { "answerText": "..." },
        "criteria": [
          {
            "criterionId": "crit-q1-a",
            "criterionName": "Definition Accuracy",
            "maxScore": 10,
            "grade": {
              "aiSuggestedScore": 8.0,
              "manualScore": null,
              "aiJustification": "...",
              "aiSuggestion": "..."
            }
          }
        ],
        "questionTotalScore": 8.0,
        "questionMaxScore": 10.0
      }
    ],
    "summary": { "totalScore": 23.5, "maxScore": 30, "percentage": 78.3, "grade": "B+" }
  }
}
```

---

## Student Answer JSON Format

```json
[
  {
    "studentId": "20841234",
    "studentName": "John Smith",
    "answers": [
      { "questionId": "q1", "answerText": "Planning fallacy is..." },
      { "questionId": "q2", "answerText": "Psychological factors include..." }
    ]
  }
]
```

---

## Testing

```bash
# Frontend component tests
npx vitest --run

# Python backend
python -m pytest tests/
```

---

## Configuration

### `src/config/settings.py`
Model names, storage paths, prompt templates, default chunk sizes

### `src/utils/jsonStorage.ts`
`GRADING_API` constant — backend URL (default: `http://localhost:5000`)

---

## Notes

- ChromaDB persists to `data/chroma_db/` and survives server restarts
- Rubric data persists to `src/data/rubrics.json` via the `/rubrics` POST endpoint
- Lecture note binaries persist to `uploads/lecture-notes/`
- All grading uses Azure OpenAI endpoints 
- Scores are of integral increment or 0.5 increment
