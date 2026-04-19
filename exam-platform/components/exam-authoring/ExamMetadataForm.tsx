"use client";

/* ------------------------------------------------------------------ */
/*  ExamMetadataForm – top section of the authoring page              */
/* ------------------------------------------------------------------ */

interface ExamMeta {
  courseCode: string;
  courseName: string;
  title: string;
  date: string;
  startTime: string;
  durationSeconds: number;
  location: string;
  instructions: string;
}

interface ExamMetadataFormProps {
  meta: ExamMeta;
  totalPoints: number;
  questionCount: number;
  onChange: (meta: ExamMeta) => void;
}

export function ExamMetadataForm({ meta, totalPoints, questionCount, onChange }: ExamMetadataFormProps) {
  const update = (patch: Partial<ExamMeta>) => onChange({ ...meta, ...patch });

  const durationMinutes = Math.round(meta.durationSeconds / 60);

  return (
    <div className="panel" style={{ display: "grid", gap: "var(--space-4)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--space-3)" }}>
        <h2 style={{ margin: 0, fontSize: "1.15rem" }}>Exam Details</h2>
        <div style={{ display: "flex", gap: "var(--space-3)" }}>
          <span className="badge badge-info">{questionCount} questions</span>
          <span className="badge badge-success">{totalPoints} points</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
        <label className="form-label">
          Course Code
          <input
            className="input"
            value={meta.courseCode}
            readOnly
            tabIndex={-1}
            style={{ background: "var(--surface-subtle, #f5f5f5)", color: "var(--text-muted)", cursor: "default" }}
            title="Course code cannot be changed here"
          />
        </label>
        <label className="form-label">
          Course Name
          <input
            className="input"
            value={meta.courseName}
            readOnly
            tabIndex={-1}
            style={{ background: "var(--surface-subtle, #f5f5f5)", color: "var(--text-muted)", cursor: "default" }}
            title="Course name cannot be changed here"
          />
        </label>
      </div>

      <label className="form-label">
        Exam Title
        <input className="input" value={meta.title} onChange={(e) => update({ title: e.target.value })} />
      </label>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "var(--space-4)" }}>
        <label className="form-label">
          Date
          <input className="input" type="date" value={meta.date} onChange={(e) => update({ date: e.target.value })} />
        </label>
        <label className="form-label">
          Start Time
          <input className="input" type="time" value={meta.startTime} onChange={(e) => update({ startTime: e.target.value })} />
        </label>
        <label className="form-label">
          Duration (min)
          <input
            className="input"
            type="number"
            min={1}
            value={durationMinutes}
            onChange={(e) => update({ durationSeconds: Number(e.target.value) * 60 })}
          />
        </label>
        <label className="form-label">
          Location
          <input className="input" value={meta.location} onChange={(e) => update({ location: e.target.value })} />
        </label>
      </div>

      <label className="form-label">
        Instructions
        <textarea
          className="textarea"
          rows={3}
          value={meta.instructions}
          placeholder="Answer ALL questions. Calculators are NOT permitted…"
          onChange={(e) => update({ instructions: e.target.value })}
        />
      </label>
    </div>
  );
}
