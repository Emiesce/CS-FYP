# Implementation Plan

- [x] 1. Fix lectureNotes serialization in JsonStorageService
  - In `saveRubrics`, extend the serialization map to explicitly convert `lectureNotes[].uploadedAt` and `lectureNotes[].processedAt` to ISO strings using `instanceof Date` guards
  - Ensure `lectureNotes` defaults to `[]` if undefined on the rubric object before mapping
  - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 2.4_

- [x] 1.1 Verify loadFromLocalStorage correctly deserializes lectureNotes dates
  - Read `loadFromLocalStorage` and confirm `lectureNotes[].uploadedAt` and `processedAt` are mapped back to `Date` objects
  - Add the same mapping to `loadRubrics` (JSON file path) if it is missing
  - _Requirements: 2.2, 2.3_

- [x] 2. Add defensive lectureNotes defaulting in RubricService
  - In `initializeStorage`, after loading rubrics from `JsonStorageService`, map over the array and set `lectureNotes: r.lectureNotes || []` for each rubric to handle legacy data with no `lectureNotes` field
  - _Requirements: 2.4, 5.1_

- [x] 3. Verify end-to-end persistence for create and edit flows
  - Trace through `CreateRubricView.handleSubmit` → `hookData.createRubric` → `RubricService.createRubric` and confirm `lectureNotes` is included in the new rubric object and passed to `saveToStorage`
  - Trace through `EditRubricView.handleSubmit` → `hookData.updateRubric` → `RubricService.updateRubric` and confirm `lectureNotes` from the updates payload is merged into the stored rubric and passed to `saveToStorage`
  - Add a targeted `console.log` in `RubricService.updateRubric` just before `saveToStorage()` to log `updatedRubric.lectureNotes.length` for debugging
  - _Requirements: 1.1, 1.2, 3.3, 4.2_
