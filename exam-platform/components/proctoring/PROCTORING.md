# Section: AI-Powered Proctoring System
## Presentation Slide Outline

---

## Slide 1: Opening Hook – "What if your exam could watch itself?"

**Content:**
- Open with a provocative question: traditional online exams rely on honour systems — ours don't have to.
- Brief visual: side-by-side of a blank webcam feed vs. the live proctoring dashboard with real-time alerts firing as a student looks away.
- One-liner thesis: *"A fully browser-native, AI-driven integrity layer — real-time alerts, no plugins, no installs, no servers for inference."*

**What to discuss:**
- Set the stakes: academic integrity in a post-COVID world is an unsolved problem; commercial tools (Proctorio, Honorlock) are invasive, expensive, and privacy-hostile.
- Tease the inventive angle: all video inference runs in-browser using WebAssembly + GPU, yet alerts reach the proctor's screen in under a second via a proper production-grade WebSocket + Redis pipeline.

---

## Slide 2: System Architecture Overview

**Content:**
- High-level diagram with four layers:
  1. **Student Browser** → MediaPipe Web Worker + MediaRecorder + Screen Monitor
  2. **Next.js API Routes** → HTTP proxy layer (REST calls)
  3. **FastAPI Backend** → REST + WebSocket server
  4. **Redis** (message broker) ↔ **PostgreSQL** (durable store)
- Highlight the two distinct data paths:
  - **Detection path** (on-device): Camera frames → Web Worker → `DetectionResult` → events
  - **Alert delivery path** (server): `POST /api/proctoring/sync` → FastAPI → Redis Pub/Sub → WebSocket → Staff dashboard

**What to discuss:**
- Student-side inference never leaves the browser; only structured event *metadata* is sent to the server — no raw video is uploaded.
- The server-side pipeline is production-grade: Redis decouples the sync writer from the WebSocket readers, allowing multiple staff monitors on different machines to all receive the same alert simultaneously.
- PostgreSQL remains the durable source of truth; Redis is the ephemeral fast lane.

---

## Slide 3: The Detection Pipeline – MediaPipe in the Browser

**Content:**
- Code/diagram walkthrough of `proctoring-worker.ts`:
  - `FaceLandmarker` initialised once via WASM CDN, running with GPU delegate
  - Each `ImageBitmap` frame analysed for:
    - **Gaze direction** (iris landmark vectors – landmarks 468–477)
    - **Face count** (zero faces / multiple faces)
    - **Frame obscuration** (luma variance analysis via `OffscreenCanvas`)
- Show the `analyse()` → `DetectionResult` pipeline.

**What to discuss:**
- Walk through the gaze detection algorithm: the iris centre (landmark 473) offset is computed relative to the eye corner landmarks. If the ratio exceeds a calibrated threshold, `gazeAway = true`.
- Frame obscuration: every pixel's luminance is sampled, variance computed — near-zero variance means the camera is covered (solid black/white frame).
- This is **entirely original** — no third-party proctoring library was used; the landmark arithmetic was designed from scratch.
- The Web Worker runs on a separate thread so camera inference never blocks the exam UI or the student's typing.

---

## Slide 4: Frame Capture Pipeline – From Camera to Inference

**Content:**
- Step-by-step diagram:
  ```
  navigator.mediaDevices.getUserMedia({ video: 640×480 })
           │
           ▼
     <video> element  (live preview, muted, playsInline)
           │
     setInterval every 500 ms  (DETECTION_CADENCE_MS)
           │
     ctx.drawImage(video, 0, 0, 320, 240)   ← ANALYSIS_FRAME_WIDTH
           │  (hidden <canvas>, off-screen)
           ▼
     createImageBitmap(canvas)  ← zero-copy transferable
           │
     worker.postMessage({ kind: "frame", bitmap }, [bitmap])
           │  ← bitmap transferred, not copied
           ▼
     Web Worker  →  FaceLandmarker.detectForVideo(bitmap, timestamp)
           │
     DetectionResult  →  postMessage back to main thread
           │
     handleDetection()  →  commitEvents()  →  React state
  ```
- Key constants: `captureIntervalMs = 500 ms` (~2 FPS), `ANALYSIS_FRAME_WIDTH = 320 px`.

- Worker messages use a tagged-union protocol:

  **Main thread → Worker (frame message):**
  ```json
  {
    "kind": "frame",
    "bitmap": "<ImageBitmap — transferred, not serialised>",
    "timestamp": 12453.7
  }
  ```

  **Worker → Main thread (result message):**
  ```json
  {
    "kind": "result",
    "result": {
      "gazeAway": true,
      "cameraBlocked": false,
      "faceCount": 1,
      "faceMissing": false
    }
  }
  ```

  **Worker → Main thread (error message):**
  ```json
  {
    "kind": "error",
    "message": "Failed to initialise MediaPipe: GPU delegate unavailable"
  }
  ```

**What to discuss:**
- The camera stream feeds a visible `<video>` element (the student sees their own feed) **and** a hidden `<canvas>` used solely for frame extraction — no second camera request is needed.
- Every 500 ms `drawImage()` renders one frame into the canvas at half resolution (320 px wide). This is critical: sending a full 640×480 frame to the GPU-accelerated MediaPipe model every half-second would saturate the bus. Downscaling to 320 px reduces per-frame data by 75% while preserving enough landmark accuracy for gaze and face-count detection.
- `createImageBitmap()` returns a `Transferable` object. It is sent to the Web Worker via `postMessage` with a **transfer list** — ownership of the raw pixel buffer moves to the worker thread with zero byte copying. After inference, `bitmap.close()` releases the GPU texture immediately.
- The worker runs `FaceLandmarker.detectForVideo()` in `VIDEO` mode, which applies temporal smoothing across successive frames — reducing jitter on landmark positions compared to the single-frame `IMAGE` mode.
- The main thread is never blocked: `setInterval` only schedules the canvas draw; all heavy inference happens inside the worker. The student can type their answers freely with no frame drops.

---

## Slide 5: Debouncing & Episode Detection – Avoiding False Positives

**Content:**
- Table showing debounce constants:
  | Signal | Debounce Threshold | Rationale |
  |---|---|---|
  | Gaze Away | 2 consecutive frames | ~1 second at 500 ms cadence |
  | Camera Blocked | 3 consecutive frames | ~1.5 seconds |
  | Face Missing | Configurable | Sustained absence only |
- Show how a **sustained gaze episode** is tracked: `gazeEpisodeStartedAt` ref, finalized into a single event with `durationSeconds`.
- A finalised gaze episode produces this event object internally before it is batched into the next sync:
  ```json
  {
    "id": "evt_a1b2c3",
    "examId": "exam_spring2026_cs101",
    "studentId": "user_42",
    "type": "gaze_away",
    "severity": 0.69,
    "startedAt": "2026-05-01T09:14:22.000Z",
    "timestamp": "2026-05-01T09:14:30.000Z",
    "durationSeconds": 8,
    "message": "Looked away from the screen for about 8 seconds"
  }
  ```

**What to discuss:**
- A naive approach fires a Redis publish on every frame the student looks away — ours batches it into one meaningful episode with a start time and duration before sending anything to the server.
- The staff dashboard therefore receives one "gaze away for 8 seconds" alert rather than 16 identical pings — far more actionable.
- `finalizeGazeEpisode()` is called both on detection and when the exam ends — no data loss at session teardown.

---

## Slide 6: The Rolling Pre-Capture Video Buffer

**Content:**
- Diagram: `WebcamPreview` → `MediaRecorder` → rolling `Blob[]` buffer (configurable window, e.g. last 12 seconds) → attached to high-severity events.
- Show the evidence clip flow: when a severity ≥ 0.7 event fires, the buffer is flushed into a single `Blob`, a blob URL is created client-side, and the binary is uploaded to the backend via `PUT /api/proctoring/events/{id}/clip`.
- MIME type preference order: `video/webm;codecs=vp9` → `video/webm;codecs=vp8` → `video/webm` (browser default).

**What to discuss:**
- This is one of the most inventive elements: the system captures **what happened before the violation**, not just a screenshot after it.
- We deliberately exclude `video/mp4` from the MIME type list. Although some browsers claim to support it via `MediaRecorder.isTypeSupported()`, MP4 format requires a complete `moov` atom header — raw MP4 chunks cannot be concatenated into a playable file. WebM is a streaming-native container; chunks are individually valid and concatenate cleanly into a single playable `Blob`.
- When building the evidence `Blob` and storing the clip in PostgreSQL, codec parameters are stripped from the MIME string (e.g. `video/webm;codecs=vp9` → `video/webm`). The `<source type>` attribute on the playback `<video>` element only needs the base container type; passing the full codec string causes certain browsers to reject the source entirely.
- The clip binary is stored in PostgreSQL against the event row; staff can play it back inline from the Student Detail panel on any machine at any time — not just the invigilator's laptop.

---

## Slide 7: Screen & Keyboard Monitoring

**Content:**
- Two-column layout:
  - **Screen Monitor** (`useScreenMonitor`):
    - `getDisplayMedia()` for screen capture (explicit consent required)
    - `visibilitychange` + `pagehide` events for tab switch / window exit detection
    - Screenshot capture at violation time via `OffscreenCanvas`
  - **Keyboard Monitor** (`useKeyboardMonitor`):
    - Intercepts: Paste, Copy, Cut, Select All, DevTools (F12), Print
    - Per-event 2-second cooldown to prevent flooding
    - Severity-weighted (DevTools: 0.9, Paste: 0.8, Copy: 0.5)

- Each detected violation is represented as a `ProctoringEvent` object, for example:
  ```json
  {
    "id": "evt_d4e5f6",
    "examId": "exam_spring2026_cs101",
    "studentId": "user_42",
    "type": "tab_switch",
    "severity": 0.75,
    "timestamp": "2026-05-01T09:17:05.000Z",
    "message": "Student switched to another browser tab"
  }
  ```
  ```json
  {
    "id": "evt_g7h8i9",
    "examId": "exam_spring2026_cs101",
    "studentId": "user_42",
    "type": "devtools_open",
    "severity": 0.9,
    "timestamp": "2026-05-01T09:18:44.000Z",
    "message": "Student attempted to open browser developer tools."
  }
  ```
  ```json
  {
    "id": "evt_j1k2l3",
    "examId": "exam_spring2026_cs101",
    "studentId": "user_42",
    "type": "clipboard_paste",
    "severity": 0.8,
    "timestamp": "2026-05-01T09:19:12.000Z",
    "message": "Student used Ctrl/Cmd+V (paste shortcut)."
  }
  ```

**"Sync to backend" — what actually happens:**

Every violation event calls `recordViolation()` → `commitEvents()` → appended to the local React events array → `saveLiveSession()` writes the full session snapshot to `localStorage` → `syncSessionToBackend()` fires a background `POST /api/proctoring/sync`.

The full HTTP request body (`ProctoringSessionSync`) looks like:
  ```json
  {
    "exam_id": "exam_spring2026_cs101",
    "student_id": "user_42",
    "student_name": "Chan Tai Man",
    "student_number": "20421234",
    "session_status": "live",
    "started_at": "2026-05-01T09:00:00.000Z",
    "ended_at": null,
    "risk_score": 87,
    "rolling_average": 64,
    "event_count": 5,
    "high_severity_event_count": 2,
    "live_status": {
      "gazeStatus": "normal",
      "cameraStatus": "clear",
      "faceCount": 1,
      "screenStatus": "monitoring",
      "focusStatus": "background"
    },
    "events": [
      {
        "id": "evt_d4e5f6",
        "type": "tab_switch",
        "severity": 0.75,
        "timestamp": "2026-05-01T09:17:05.000Z",
        "startedAt": "2026-05-01T09:17:05.000Z",
        "durationSeconds": 1,
        "message": "Student switched to another browser tab",
        "evidenceClipMimeType": null
      }
    ],
    "buckets": [
      { "label": "10s", "score": 0 },
      { "label": "20s", "score": 0 },
      { "label": "1030s", "score": 75 }
    ]
  }
  ```

FastAPI upserts the session and all new events into PostgreSQL, then **publishes to Redis**.

**"Publish to Redis" — what actually happens:**

After the database write succeeds, FastAPI calls `await publish_alert(exam_id, payload)`. This executes:
```
PUBLISH exam:exam_spring2026_cs101:alerts <json>
```
The JSON published to the Redis channel is:
  ```json
  {
    "session_id": "sess_abc123",
    "student_id": "user_42",
    "student_name": "Chan Tai Man",
    "risk_score": 87,
    "rolling_average": 64,
    "events": [
      {
        "id": "evt_d4e5f6",
        "type": "tab_switch",
        "severity": 0.75,
        "timestamp": "2026-05-01T09:17:05.000Z",
        "message": "Student switched to another browser tab",
        "duration_seconds": 1
      }
    ]
  }
  ```

Any FastAPI WebSocket handler subscribed to `exam:exam_spring2026_cs101:alerts` receives this message and immediately forwards it to every connected staff browser as a WebSocket frame:
  ```json
  {
    "type": "alert",
    "exam_id": "exam_spring2026_cs101",
    "session_id": "sess_abc123",
    "student_id": "user_42",
    "student_name": "Chan Tai Man",
    "risk_score": 87,
    "rolling_average": 64,
    "events": [
      {
        "id": "evt_d4e5f6",
        "type": "tab_switch",
        "severity": 0.75,
        "timestamp": "2026-05-01T09:17:05.000Z",
        "message": "Student switched to another browser tab",
        "duration_seconds": 1
      }
    ]
  }
  ```

**What to discuss:**
- The 120 ms delay before a `tab_switch` fires prevents false positives from OS-level focus flickers.
- `pagehide` vs `visibilitychange` are differentiated: navigating away entirely (`window_exit`, severity 0.92) is treated as more severe than switching tabs.
- Keyboard monitoring uses a stable `ref` for the callback so the event listener is never re-attached on parent re-renders.
- The sync call is `keepalive: true` — it completes even if the student closes the browser tab mid-exam.
- `syncSessionToBackend()` swallows all fetch errors silently. Redis being unavailable never fails the sync to PostgreSQL; a broken network never crashes the student's exam UI. All three layers (React state, `localStorage`, PostgreSQL) degrade independently.

---

## Slide 8: Real-Time Alert Delivery — Redis Pub/Sub + WebSocket

**Content:**
- Architecture diagram:
  ```
  Student Browser
      │  POST /api/proctoring/sync  (debounced, on new events)
      ▼
  FastAPI  ──publish──▶  Redis  exam:{exam_id}:alerts
                                      │
                                  subscribe
                                      │
                              FastAPI WebSocket
                                      │
                              ws://backend/ws/proctoring/{exam_id}
                                      │
                          Staff Dashboard (useProctoringWebSocket)
  ```
- Key implementation points:
  - Channel: `exam:{exam_id}:alerts`
  - WebSocket endpoint: `GET /ws/proctoring/{exam_id}` (JWT auth handshake on open)
  - Heartbeat: server sends `{"type":"ping"}` every 25 seconds to prevent idle teardown
  - Auto-reconnect: client retries with 3-second back-off on close/error

- Full WebSocket message protocol:

  **Client → Server (auth handshake, sent immediately on `onopen`):**
  ```json
  { "type": "auth", "token": "<JWT Bearer token>" }
  ```

  **Server → Client (handshake accepted):**
  ```json
  { "type": "auth_ok", "exam_id": "exam_spring2026_cs101" }
  ```

  **Server → Client (live alert):**
  ```json
  {
    "type": "alert",
    "exam_id": "exam_spring2026_cs101",
    "session_id": "sess_abc123",
    "student_id": "user_42",
    "student_name": "Chan Tai Man",
    "risk_score": 87,
    "rolling_average": 64,
    "events": [
      {
        "id": "evt_d4e5f6",
        "type": "tab_switch",
        "severity": 0.75,
        "timestamp": "2026-05-01T09:17:05.000Z",
        "message": "Student switched to another browser tab",
        "duration_seconds": 1
      }
    ]
  }
  ```

  **Server → Client (keep-alive, every 25 s):**
  ```json
  { "type": "ping" }
  ```

**What to discuss:**
- Redis Pub/Sub was chosen over polling or SSE because it is **fan-out native**: ten staff monitors connected to the same exam all receive the alert at the same time with zero additional load on the database.
- The WebSocket connection requires a valid JWT with a staff role (`instructor`, `teaching_assistant`, `administrator`) — students cannot connect.
- The Redis pool is shared across requests (max 20 connections) and closed gracefully via FastAPI's `lifespan` context — no connection leaks.
- If Redis is temporarily unavailable the sync endpoint still succeeds and the alert is simply not fanned out in real time; the staff can always refresh from PostgreSQL. Resilience by design.

---

## Slide 9: Risk Scoring & Bucket Aggregation

**Content:**
- Formula display:
  $$\text{Risk Score} = \min\left(100,\ \sum_{e \in \text{events}} \text{severity}(e) \times 100\right)$$
- 10-second bucket aggregation: every 10 seconds, events in the window are scored and stored as a `PersistedBucketPoint`.
- Rolling average: last 3 buckets averaged for the "current risk" metric.
- Show the `SuspiciousActivityChart` visualization.

**What to discuss:**
- Buckets allow staff to see *when* during the exam risk spiked, not just the total score.
- The rolling 3-bucket average smooths transient spikes — a student who glanced away once doesn't appear perpetually high-risk.
- All bucket data is persisted to PostgreSQL (`proctoring_buckets` table) with an ordinal index for accurate timeline reconstruction even after the WebSocket session ends.
- Each WebSocket `alert` message also carries the current `risk_score` and `rolling_average` so the dashboard badge updates in real time without an extra API call.

---

## Slide 10: Staff Review Dashboard – Closing the Loop

**Content:**
- Screenshots / live demo of:
  1. **Student Roster** with risk badges (green / amber / red) updating in real time as WebSocket alerts arrive
  2. **Student Detail** panel: violation timeline, event breakdown table, inline evidence clip playback
  3. **WebSocket status indicator** (connecting / live / reconnecting)
- Mention the analytics cross-reference: students with high grades *and* high risk scores are surfaced automatically.

- The roster is populated by `GET /api/proctoring/exams/{exam_id}/sessions` which returns:
  ```json
  [
    {
      "id": "sess_abc123",
      "exam_id": "exam_spring2026_cs101",
      "student_id": "user_42",
      "student_name": "Chan Tai Man",
      "student_number": "20421234",
      "session_status": "live",
      "started_at": "2026-05-01T09:00:00.000Z",
      "updated_at": "2026-05-01T09:19:12.000Z",
      "ended_at": null,
      "risk_score": 87,
      "rolling_average": 64,
      "event_count": 5,
      "high_severity_event_count": 2,
      "live_status": {
        "gazeStatus": "normal",
        "cameraStatus": "clear",
        "faceCount": 1,
        "screenStatus": "monitoring",
        "focusStatus": "background"
      },
      "events": [],
      "buckets": [
        { "label": "10s", "score": 0 },
        { "label": "20s", "score": 0 },
        { "label": "1030s", "score": 75 }
      ]
    }
  ]
  ```

- Drilling into a student calls `GET /api/proctoring/sessions/{session_id}` with `events` populated:
  ```json
  {
    "id": "sess_abc123",
    "events": [
      {
        "id": "evt_d4e5f6",
        "exam_id": "exam_spring2026_cs101",
        "student_id": "user_42",
        "event_type": "tab_switch",
        "severity": 0.75,
        "timestamp": "2026-05-01T09:17:05.000Z",
        "started_at": "2026-05-01T09:17:05.000Z",
        "duration_seconds": 1,
        "message": "Student switched to another browser tab",
        "has_evidence_clip": null
      },
      {
        "id": "evt_g7h8i9",
        "event_type": "gaze_away",
        "severity": 0.69,
        "timestamp": "2026-05-01T09:14:30.000Z",
        "started_at": "2026-05-01T09:14:22.000Z",
        "duration_seconds": 8,
        "message": "Looked away from the screen for about 8 seconds",
        "has_evidence_clip": "video/webm"
      }
    ]
  }
  ```
  When `has_evidence_clip` is non-null, the dashboard renders an inline `<video>` pointing to `GET /api/proctoring/events/{event_id}/clip`.

**What to discuss:**
- Before this upgrade the roster only updated when the staff member manually refreshed or if the student and proctor happened to share the same browser (via `BroadcastChannel`). Now it updates within milliseconds on any machine, anywhere.
- Evidence clips play inline from the backend — no download, no local storage dependency.
- The hook (`useProctoringWebSocket`) exposes `alertHistory` so the dashboard can show a full chronological log of everything that happened during the exam without a page reload.

---

## Slide 11: Privacy & Design Principles

**Content:**
- Key design decisions listed:
  - ✅ All video **inference** happens **on-device** — no frames sent to any server
  - ✅ Evidence clips are stored in PostgreSQL as **binary blobs**, served only to authenticated staff
  - ✅ Screen capture requires **explicit student consent** (`getDisplayMedia` prompt)
  - ✅ Camera requires **explicit permission grant**
  - ✅ Redis stores only **ephemeral event payloads** — no video, no PII beyond name/ID
  - ✅ WebSocket stream is **JWT-gated** to staff roles only
  - ✅ Redis channel data **expires** when the exam ends (no long-lived sensitive data in the broker)

**What to discuss:**
- Privacy was a first-class design constraint, not an afterthought.
- Contrast with commercial proctoring tools that upload full video streams to third-party servers indefinitely.
- Our Redis Pub/Sub channel carries only structured JSON event metadata — even if an attacker somehow intercepted the Redis stream they would see event types and timestamps, never video.
- The JWT auth handshake on WebSocket open means a plain `ws://` URL is not enough; a valid staff token is required.

---

## Slide 12: Summary – What Makes This Original & Production-Ready

**Content:**
- Bullet summary of inventive and production-grade elements:
  - 🧠 Real neural network inference (MediaPipe FaceLandmarker) in a **Web Worker with GPU acceleration** — zero server GPU cost
  - 📹 Rolling **pre-capture buffer** delivers evidence of what happened *before* a violation — stored durably in PostgreSQL
  - ⚡ **Redis Pub/Sub fan-out** → staff dashboards receive alerts in < 1 second regardless of which machine they're on
  - 🔌 **Production WebSocket** with JWT auth, 25-second keep-alive, and automatic client-side reconnection
  - 🎯 **Episode-based event model** with start time + duration — no per-frame noise reaching the broker
  - 🔒 **Privacy-preserving architecture** — raw video never leaves the device; Redis holds only metadata
  - 🔗 **Seamless grading integration** — risk scores appear alongside academic scores in analytics

**What to discuss:**
- Emphasise the architectural maturity: this is not a prototype that works only when student and proctor share a browser tab. It is a proper distributed system — student browser → FastAPI → Redis → WebSocket → any staff browser, anywhere on the network.
- Invite the panel to open the live demo: start an exam as a student in one tab, open the staff monitoring page on another machine/browser, and watch violation alerts appear in real time the moment the sync fires.
- None of these components were pulled from a proctoring library — detection, buffering, broker integration, and WebSocket delivery were all built from scratch on top of browser primitives and open standards.
