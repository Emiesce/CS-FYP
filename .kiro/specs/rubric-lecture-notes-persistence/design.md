# Design Document: Rubric Lecture Notes Persistence

## Overview

Lecture notes uploaded during rubric create/edit are lost after saving because of two compounding bugs:

1. **Serialization gap** — `JsonStorageService.saveRubrics` serializes top-level rubric dates but does NOT explicitly serialize `lectureNotes[].uploadedAt` / `processedAt`. When the rubric is sent to the backend (`POST /rubrics`) or saved to `localStorage`, the `Date` objects inside `lectureNotes` are either dropped or serialized inconsistently, so the round-trip breaks silently.

2. **State sync gap** — After `updateRubric` + `refreshRubrics`, the in-memory rubrics list is updated. But `handleEditRubric` reads `latest.lectureNotes` from that list. If the serialization is broken, the list contains rubrics with `lectureNotes: []` even though the user just uploaded files.

3. **Create flow** — Same serialization issue applies when creating a rubric with lecture notes.

### Persistence Layers

The app uses two persistence layers:

| Layer | Survives tab close? | Survives browser close? | Survives terminal restart? |
|---|---|---|---|
| `localStorage` | ✅ | ✅ | ✅ |
| `src/data/rubrics.json` (via `POST /rubrics`) | ✅ | ✅ | ✅ |

Both layers are written on every save. The JSON file is the source of truth on page load (if `localStorage` is empty). The fix must ensure `lectureNotes` is correctly serialized in **both** layers.

## Architecture

```
User uploads lecture note in EditRubricView / CreateRubricView
  └── LectureNotesSection.onNotesChange → editingLectureNotes state

User clicks "Update Rubric" / "Create Rubric"
  └── hookData.updateRubric(id, { ...fields, lectureNotes })
        └── RubricService.updateRubric
              └── globalMockRubrics[i] = merged rubric (with lectureNotes)
              └── saveToStorage()
                    └── JsonStorageService.saveRubrics(globalMockRubrics)
                          ├── POST /rubrics → writes src/data/rubrics.json  ← survives terminal restart
                          └── localStorage.setItem('rubrics', ...)           ← survives browser close

On next page load:
  └── JsonStorageService.initializeStorage()
        ├── loadFromLocalStorage() → if data exists, use it
        └── loadRubrics() → fetch /src/data/rubrics.json as fallback
```

The fix is applied at one layer: **`JsonStorageService.saveRubrics`** — ensure `lectureNotes` date fields are serialized as ISO strings before writing to either storage target.

## Components and Interfaces

### 1. JsonStorageService (`src/utils/jsonStorage.ts`) — PRIMARY FIX

**`saveRubrics`** — extend serialization to explicitly handle `lectureNotes`:

```ts
const serializedRubrics = rubrics.map(rubric => ({
  ...rubric,
  createdAt: rubric.createdAt instanceof Date
    ? rubric.createdAt.toISOString()
    : rubric.createdAt,
  updatedAt: rubric.updatedAt instanceof Date
    ? rubric.updatedAt.toISOString()
    : rubric.updatedAt,
  lectureNotes: (rubric.lectureNotes || []).map(note => ({
    ...note,
    uploadedAt: note.uploadedAt instanceof Date
      ? note.uploadedAt.toISOString()
      : note.uploadedAt,
    processedAt: note.processedAt instanceof Date
      ? note.processedAt.toISOString()
      : (note.processedAt ?? null),
  })),
}));
```

**`loadFromLocalStorage`** — already maps `lectureNotes` dates back correctly. Verify and keep as-is.

**`loadRubrics`** (from JSON file) — already maps `lectureNotes` dates back correctly. Verify and keep as-is.

### 2. RubricService (`src/services/RubricService.ts`) — DEFENSIVE FIX

In `initializeStorage`, after loading from `JsonStorageService`, ensure every rubric has `lectureNotes` defaulted to `[]` if missing (handles legacy data):

```ts
globalMockRubrics = storedRubrics.map(r => ({
  ...r,
  lectureNotes: r.lectureNotes || [],
}));
```

### 3. RubricUploadPage (`src/components/RubricUploadPage.tsx`) — NO CHANGE NEEDED

The `handleEditRubric` already reads the latest rubric from `hookData.rubrics` and sets `editingLectureNotes`. Once the storage fix is in place, this will work correctly.

The `EditRubricView` `handleSubmit` already passes `lectureNotes` in `updatedRubricData`. No change needed.

### 4. LectureNotesSection (`src/components/rubric/LectureNotesSection.tsx`) — NO CHANGE NEEDED

Uses `useState(initialNotes)` seeded on mount. `EditRubricView` has `key={selectedRubric.id}` so it remounts when switching rubrics, ensuring `initialNotes` is always fresh. No change needed.

## Data Models

`LectureNote` serialized form in storage:
```json
{
  "id": "note-1234567890-0",
  "filename": "lecture.pdf",
  "originalName": "lecture.pdf",
  "fileSize": 102400,
  "fileType": "pdf",
  "uploadedAt": "2026-04-07T10:00:00.000Z",
  "associatedRubrics": [],
  "metadata": {
    "processingStatus": "completed"
  }
}
```

`RubricData` serialized form (relevant fields):
```json
{
  "id": "rubric-1234567890",
  "title": "My Rubric",
  "createdAt": "2026-04-07T09:00:00.000Z",
  "updatedAt": "2026-04-07T10:00:00.000Z",
  "lectureNotes": [
    {
      "id": "note-1234567890-0",
      "uploadedAt": "2026-04-07T10:00:00.000Z"
    }
  ]
}
```

## Error Handling

- If `lectureNotes` is `undefined` on a rubric (legacy data), default to `[]` at every read site.
- Use `instanceof Date` checks before calling `.toISOString()` to handle cases where the value is already a string (e.g., loaded from JSON).
- `FileStorageService.removeFile` failures are silently ignored — keep that behavior.
- If the backend `POST /rubrics` fails, `localStorage` still has the data, so the user won't lose work within the same browser session.

## Testing Strategy

- Verify `saveRubrics` serializes `lectureNotes[].uploadedAt` as ISO string (not `[object Object]` or dropped).
- Verify `loadFromLocalStorage` deserializes `lectureNotes[].uploadedAt` back to a `Date` instance.
- Manual flow: upload note in edit view → click Update Rubric → close and reopen browser → navigate to manage → click View → confirm note is listed.
- Manual flow: upload note in create view → click Create Rubric → close and reopen browser → navigate to manage → click View → confirm note is listed.
- Manual flow: delete a note in edit view → click Update Rubric → reopen → confirm note is gone.
