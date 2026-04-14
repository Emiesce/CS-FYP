# Project Documentation

## Overview

This is an AI-powered essay grading system with a React/TypeScript frontend and a Python/Flask backend. The system allows educators to create rubrics, upload student answers, and have them graded automatically using Azure OpenAI (GPT-4o-mini). Graders can then review and override AI scores.

---

## Repository Structure

```
/
├── grading_api.py                  # Flask API server — all REST endpoints
├── src/
│   ├── grading_system.py           # Core RAG grading orchestration
│   ├── models/
│   │   └── grading_models.py       # Pydantic data models
│   ├── implementations/
│   │   ├── azure_ai_client.py      # Azure OpenAI client (embeddings + chat)
│   │   ├── chroma_vector_store.py  # ChromaDB vector store for RAG
│   │   └── production_grading_service.py  # Grading pipeline orchestration
│   ├── interfaces/
│   │   ├── ai_client.py            # AI client interface
│   │   ├── grading_service.py      # Grading service interface
│   │   └── vector_store.py         # Vector store interface
│   ├── services/
│   │   ├── lecture_notes_service.py    # Lecture notes upload/processing
│   │   └── lecture_notes_validator.py  # File validation
│   ├── utils/
│   │   ├── grading_storage.py      # Grading results persistence (JSON)
│   │   ├── lecture_notes_storage.py # Lecture notes metadata persistence
│   │   └── jsonStorage.ts          # Frontend JSON storage utilities
│   ├── data/
│   │   ├── rubrics.json            # Persisted rubric definitions
│   │   ├── grading_results.json    # Persisted grading results
│   │   └── lecture_notes.json      # Lecture notes metadata
│   ├── pages/
│   │   ├── GradingResultsPage.tsx  # Grading review UI
│   │   └── StudentAnswersPage.tsx  # Student answer submission UI
│   ├── components/
│   │   ├── RubricUploadPage.tsx    # Rubric create/edit UI
│   │   ├── Sidebar.tsx             # Navigation sidebar
│   │   ├── rubric/                 # Rubric display components
│   │   └── lecture-notes/          # Lecture notes management components
│   └── types/
│       └── index.ts                # Shared TypeScript type definitions
├── data/
│   └── chroma_db/                  # ChromaDB persistent vector store
├── uploads/
│   └── lecture-notes/              # Uploaded lecture note binaries
└── .env                            # API keys and configuration
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Tailwind CSS, Vite |
| Backend | Python 3.11+, Flask, Flask-CORS |
| AI | Azure OpenAI (GPT-4o-mini, text-embedding-ada-002) |
| Vector DB | ChromaDB (persistent, on-disk) |
| File parsing | pdfplumber, PyMuPDF, PyPDF2, python-docx |
| Data storage | JSON files (rubrics, grading results, lecture notes metadata) |

---

## Environment Variables

```
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_ENDPOINT=https://hkust.azure-api.net
AZURE_OPENAI_CHAT_DEPLOYMENT=gpt-4o-mini
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-ada-002
AZURE_OPENAI_API_VERSION=2024-10-21
```

---

## API Reference

Base URL: `http://localhost:5000`

All JSON responses follow this envelope:
```json
{ "success": true|false, "data": ..., "message": "...", "error": "..." }
```

---

### Health

#### `GET /health`

**When called:** On app startup and periodic health checks from the frontend.

**Input:** None

**Output:**
```json
{
  "status": "healthy",
  "grading_available": true,
  "timestamp": "2026-04-14T12:00:00"
}
```

---

### Rubric File Parsing

#### `POST /extract-pdf`

**When called:** When a user uploads a PDF/DOCX/TXT file on the rubric creation page to auto-populate the rubric form.

**What it does:**
1. Extracts raw text from the uploaded file using pdfplumber / python-docx / plain text decoder
2. Sends the extracted text to GPT-4o-mini with a structured prompt to parse it into a rubric JSON object

**Input:** `multipart/form-data`
| Field | Type | Required | Description |
|---|---|---|---|
| `file` | File | Yes | PDF, DOCX, TXT, or MD file |

**Output:**
```json
{
  "success": true,
  "content": "Raw extracted text...",
  "rubric": {
    "title": "MGMT 3130 Rubric",
    "description": "...",
    "questions": [
      {
        "id": "q1",
        "title": "Explain the planning fallacy",
        "description": "...",
        "minScore": 0,
        "maxScore": 10,
        "scoringCriteria": [],
        "criteria": [
          {
            "id": "crit1",
            "name": "Content",
            "scoreLevels": [
              { "id": "sl1", "scoreRange": "8-10", "description": "Excellent...", "minPoints": 8, "maxPoints": 10 }
            ]
          }
        ]
      }
    ]
  },
  "metadata": {
    "file_type": "pdf",
    "word_count": 450,
    "page_count": 2,
    "filename": "rubric.pdf"
  }
}
```

**Note:** The GPT parsing step makes 1–2 Azure API calls and is the main source of latency (~5–15s).

---

### Rubrics Persistence

#### `POST /rubrics`

**When called:** Every time the user saves or updates a rubric from the rubric editor UI (`RubricUploadPage.tsx` → `RubricService.ts`).

**What it does:** Overwrites `src/data/rubrics.json` with the full rubrics array.

**Input:** `application/json` — array of rubric objects
```json
[
  {
    "id": "rubric-1",
    "title": "MGMT 3130 Rubric",
    "description": "...",
    "questions": [ ... ],
    "createdAt": "2026-04-14T12:00:00Z"
  }
]
```

**Output:**
```json
{ "success": true, "message": "Saved 3 rubrics" }
```

---

### Grading

#### `POST /grade-answer`

**When called:** When the user clicks "Grade" on the Student Answers page (`StudentAnswersPage.tsx`). Also called per-student in batch grading.

**What it does:**
1. Loads the rubric/marking scheme by `marking_scheme_id`
2. For each question, runs a ChromaDB similarity search to retrieve relevant lecture note chunks (RAG context)
3. Calls GPT-4o-mini with the student answer + rubric criteria + lecture note context
4. Saves the result to `grading_results.json`

**Input:** `application/json`
```json
{
  "student_id": "20841234",
  "student_name": "John Smith",
  "marking_scheme_id": "rubric-1",
  "assignment_id": "midterm",
  "course_id": "MGMT2011",
  "submitted_at": "2026-04-14T10:00:00Z",
  "question_answers": [
    {
      "question_id": "q1",
      "answer_text": "The planning fallacy is..."
    },
    {
      "question_id": "q2",
      "answer_text": "Psychological factors include..."
    }
  ]
}
```

**Output:**
```json
{
  "data": {
    "studentID": "20841234",
    "studentName": "John Smith",
    "examId": "midterm",
    "examTitle": "MGMT 3130 Rubric",
    "gradedAt": "2026-04-14T12:31:58Z",
    "status": "graded",
    "questions": [
      {
        "questionId": "q1",
        "questionNumber": "1a",
        "questionText": "Explain the planning fallacy",
        "studentAnswer": { "answerText": "...", "wordCount": 110 },
        "criteria": [
          {
            "criterionId": "crit1",
            "criterionName": "Content",
            "maxScore": 10.0,
            "grade": {
              "manualScore": null,
              "aiSuggestedScore": 8.0,
              "highlightedText": "...",
              "aiJustification": "...",
              "aiSuggestion": "..."
            }
          }
        ],
        "questionTotalScore": 8.0,
        "questionMaxScore": 10.0,
        "questionPercentage": 80.0
      }
    ],
    "summary": {
      "totalScore": 17.0,
      "maxScore": 20.0,
      "percentage": 85.0,
      "grade": "A"
    }
  },
  "success": true,
  "_metadata": { "marking_scheme_id": "rubric-1" }
}
```

#### `POST /grade-essay`

Alias for `/grade-answer`. Kept for backward compatibility.

---

#### `POST /grade-batch`

**When called:** When the user clicks "Grade All" on the Student Answers page to grade multiple students at once.

**What it does:** Runs `/grade-answer` concurrently for all submissions with a sliding-window rate limiter (default 55 RPM to stay under Azure's 60 RPM limit).

**Input:** `application/json`
```json
{
  "submissions": [
    {
      "student_id": "20841234",
      "student_name": "John Smith",
      "marking_scheme_id": "rubric-1",
      "question_answers": [ ... ]
    },
    { ... }
  ],
  "requests_per_minute": 55
}
```

**Output:**
```json
{
  "success": true,
  "total": 3,
  "succeeded": 3,
  "failed": 0,
  "results": [ ... ],
  "errors": []
}
```

---

### Grading Results

#### `GET /grading-results`

**When called:** On load of the Grading Results page (`GradingResultsPage.tsx`).

**Query parameters:**
| Param | Description |
|---|---|
| `assignment_id` | Filter by assignment |
| `marking_scheme_id` | Filter by rubric |

**Output:**
```json
{
  "success": true,
  "data": [ /* array of grading result objects */ ],
  "count": 9,
  "message": "Found 9 grading results"
}
```

---

#### `GET /grading-results/<student_id>`

**When called:** When viewing results for a specific student.

**Output:** Same envelope as above, filtered to one student.

---

#### `PUT /grading-results/update`

**When called:** When a grader edits a score, justification, or suggestion in the grading review UI, or clicks "Submit" to finalize.

**What it does:** Updates `manualScore`, `aiJustification`, or `aiSuggestion` on specific criteria, recalculates question totals and summary, optionally marks the result as `finalized`.

**Input:** `application/json`
```json
{
  "result_id": "grade_20260411_000706_20841236_97df28",
  "student_id": "20841234",
  "updates": [
    {
      "question_index": 0,
      "criterion_index": 0,
      "manual_score": 8.5,
      "justification": "Updated justification text",
      "suggestion": "Updated suggestion text"
    }
  ],
  "finalize": false
}
```

**Output:** Full updated grading result object.

---

#### `GET /grading-statistics`

**When called:** Statistics/dashboard views.

**Output:**
```json
{
  "success": true,
  "data": {
    "total_results": 50,
    "unique_students": 25,
    "unique_assignments": 5,
    "average_score_percentage": 78.5,
    "date_range": { "earliest": "...", "latest": "..." }
  }
}
```

---

### Rubric Listing

#### `GET /available-rubrics`

**When called:** When the student answers page or grading page needs to populate a rubric selector dropdown.

**Output:**
```json
{
  "success": true,
  "data": [
    { "id": "rubric-1", "title": "MGMT 3130 Rubric", "description": "...", "created_at": "..." }
  ],
  "count": 3
}
```

---

#### `GET /debug-rubric/<rubric_id>`

**When called:** Developer/debug use only. Shows how a rubric is parsed into marking scheme criteria.

**Output:** List of criteria with their `question_id`, `question_title`, and `max_score`.

---

### Lecture Notes

#### `POST /api/lecture-notes/upload`

**When called:** When a user uploads a lecture note file in the Lecture Notes management UI.

**What it does:**
1. Extracts text from the file (PDF/DOCX/TXT/MD)
2. Chunks the content by paragraph
3. Generates embeddings via Azure `text-embedding-ada-002`
4. Stores chunks in ChromaDB with rubric association metadata
5. Saves binary to `uploads/lecture-notes/`
6. Saves metadata to `lecture_notes.json`

**Input:** `multipart/form-data`
| Field | Type | Required | Description |
|---|---|---|---|
| `file` | File | Yes | PDF, DOCX, TXT, or MD (max 50MB) |
| `associate_with_rubric` | string | No | Rubric ID to associate with |

**Output:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "filename": "uuid_lecture_01.pdf",
    "original_name": "lecture_01.pdf",
    "file_size": 1024000,
    "file_type": "pdf",
    "uploaded_at": "2026-04-14T12:00:00Z",
    "processing_status": "completed",
    "word_count": 1500,
    "associated_rubrics": ["rubric-1"]
  },
  "message": "Lecture note uploaded successfully"
}
```

---

#### `GET /api/lecture-notes`

**When called:** On load of the Lecture Notes management page.

**Query parameters:**
| Param | Description |
|---|---|
| `rubric_id` | Filter notes by associated rubric |

**Output:** Array of lecture note metadata objects.

---

#### `GET /api/lecture-notes/download/<note_id>`

**When called:** When a user clicks "Download" on a lecture note.

**Output:** Binary file download (original uploaded file).

---

#### `DELETE /api/lecture-notes/<note_id>`

**When called:** When a user deletes a lecture note.

**What it does:** Removes the note metadata, deletes its ChromaDB chunks, and removes the binary from disk.

**Output:**
```json
{ "success": true, "message": "Lecture note deleted successfully" }
```

---

#### `PUT /api/lecture-notes/<note_id>/associate`

**When called:** When a user associates or disassociates a lecture note with rubrics.

**Input:** `application/json`
```json
{
  "rubric_ids": ["rubric-1", "rubric-2"],
  "action": "associate"
}
```
`action` is either `"associate"` or `"disassociate"`.

**Output:**
```json
{
  "success": true,
  "data": {
    "note_id": "uuid",
    "associated_rubrics": ["rubric-1", "rubric-2"],
    "success_count": 2,
    "failed_count": 0
  }
}
```

---

#### `POST /api/lecture-notes/search`

**When called:** When a user types in the lecture notes search box.

**Input:** `application/json`
```json
{
  "query": "planning fallacy",
  "rubric_id": "rubric-1"
}
```

**Output:** Array of matching notes with a `match_preview` snippet showing context around the match.

---

#### `GET /api/lecture-notes/rubric/<rubric_id>`

**When called:** When the rubric editor loads to show which lecture notes are associated with a rubric.

**Output:** Array of lecture note metadata objects for that rubric.

---

#### `GET /api/lecture-notes/<note_id>/preview`

**When called:** When a user clicks to preview a lecture note's content.

**Query parameters:**
| Param | Default | Description |
|---|---|---|
| `max_length` | 1000 | Max characters to return (capped at 10000) |

**Output:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "original_name": "lecture_01.pdf",
    "content_preview": "First 1000 chars...",
    "full_content_available": true,
    "content_length": 15000,
    "word_count": 1500
  }
}
```

---

#### `GET /api/lecture-notes/statistics`

**When called:** Statistics/dashboard views for lecture notes.

**Output:**
```json
{
  "success": true,
  "data": {
    "total_notes": 10,
    "total_size_mb": 25.5,
    "file_types": { "pdf": 5, "docx": 3, "txt": 2 },
    "processing_status": { "completed": 8, "failed": 1, "pending": 1 },
    "total_associations": 15,
    "unique_rubrics": 3
  }
}
```

---

## Data Models

### Rubric (`src/data/rubrics.json`)

```json
{
  "id": "rubric-1",
  "title": "MGMT 3130 Rubric",
  "description": "...",
  "createdAt": "2026-04-14T12:00:00Z",
  "questions": [
    {
      "id": "q1",
      "label": "1a",
      "title": "Explain the planning fallacy",
      "description": "...",
      "minScore": 0,
      "maxScore": 10,
      "modelAnswer": "...",
      "scoringCriteria": [],
      "criteria": [
        {
          "id": "crit1",
          "name": "Content",
          "scoreLevels": [
            { "id": "sl1", "scoreRange": "8-10", "description": "Excellent", "minPoints": 8, "maxPoints": 10 }
          ]
        }
      ]
    }
  ]
}
```

### Grading Result (`src/data/grading_results.json`)

```json
{
  "id": "grade_20260414_123158_20841234_abc123",
  "saved_at": "2026-04-14T12:31:58",
  "success": true,
  "_metadata": {
    "marking_scheme_id": "rubric-1",
    "assignment_id": "rubric-1"
  },
  "data": {
    "studentID": "20841234",
    "studentName": "John Smith",
    "examId": "rubric-1",
    "examTitle": "MGMT 3130 Rubric",
    "gradedAt": "2026-04-14T12:31:58Z",
    "status": "graded | finalized",
    "questions": [
      {
        "questionId": "q1",
        "questionNumber": "1a",
        "questionText": "Explain the planning fallacy",
        "studentAnswer": { "answerText": "...", "wordCount": 110 },
        "criteria": [
          {
            "criterionId": "crit1",
            "criterionName": "Content",
            "maxScore": 10.0,
            "grade": {
              "manualScore": null,
              "aiSuggestedScore": 8.0,
              "highlightedText": "...",
              "aiJustification": "...",
              "aiSuggestion": "...",
              "gradedBy": "ai_system",
              "gradedAt": "2026-04-14T12:31:58Z"
            }
          }
        ],
        "questionTotalScore": 8.0,
        "questionMaxScore": 10.0,
        "questionPercentage": 80.0
      }
    ],
    "summary": {
      "totalScore": 17.0,
      "maxScore": 20.0,
      "percentage": 85.0,
      "grade": "A"
    }
  }
}
```

### Grade Scale

| Percentage | Grade |
|---|---|
| ≥ 90% | A+ |
| ≥ 85% | A |
| ≥ 80% | A- |
| ≥ 75% | B+ |
| ≥ 70% | B |
| ≥ 65% | B- |
| ≥ 60% | C+ |
| ≥ 55% | C |
| ≥ 50% | C- |
| < 50% | F |

---

## Grading Pipeline

```
Student Answer
      │
      ▼
POST /grade-answer
      │
      ├─ Load rubric from rubrics.json
      ├─ Convert rubric → MarkingScheme (flat criteria list, tagged with question_id)
      ├─ Group criteria by question_id
      │
      └─ For each question group:
            ├─ ChromaDB similarity_search (rubric chunks + lecture note chunks)
            ├─ If 1 criterion → single GPT call
            └─ If N criteria → one multi-criteria GPT call (returns JSON array)
                  │
                  └─ Results assembled → grading_results.json
```

---

## Frontend Pages & Their API Calls

| Page | Component | API Calls |
|---|---|---|
| Rubric List | `RubricUploadPage.tsx` | `GET /available-rubrics`, `POST /rubrics` |
| Rubric Create/Edit | `RubricUploadPage.tsx` | `POST /extract-pdf`, `POST /rubrics` |
| Student Answers | `StudentAnswersPage.tsx` | `GET /available-rubrics`, `POST /grade-batch` |
| Grading Results | `GradingResultsPage.tsx` | `GET /grading-results`, `PUT /grading-results/update` |
| Lecture Notes | `LectureNotesManagement.tsx` | All `/api/lecture-notes/*` endpoints |

---

## Running the Project

**Backend:**
```bash
pip install -r requirements.txt
python grading_api.py
# Server starts on http://localhost:5000
```

**Frontend:**
```bash
npm install
npm run dev
# App starts on http://localhost:5173
```

**Required environment variables** (in `.env`):
```
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_ENDPOINT=...
```
