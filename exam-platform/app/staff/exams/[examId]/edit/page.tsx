"use client";

/* ------------------------------------------------------------------ */
/*  Staff Exam Authoring Page                                         */
/*  /staff/exams/[examId]/edit                                        */
/* ------------------------------------------------------------------ */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import {
  ExamMetadataForm,
  QuestionListSidebar,
  QuestionEditorPanel,
} from "@/components/exam-authoring";
import { getVisibleCourses } from "@/features/catalog/catalog-service";
import { computeTotalPoints, fetchExamDefinition, saveExamDefinition, listCourseMaterials, uploadCourseMaterial, deleteCourseMaterial } from "@/features/exams/exam-service";
import type { Course, ExamDefinition, ExamQuestion, CourseMaterial } from "@/types";
import { useSession } from "@/features/auth";
import Link from "next/link";

/* ------------------------------------------------------------------ */
/*  Helper – resolve fixture or blank definition                      */
/* ------------------------------------------------------------------ */

function loadDefinition(examId: string, selectedCourse?: Course): ExamDefinition {
  // Blank scaffold for a brand-new exam
  return {
    id: examId,
    courseCode: selectedCourse?.code ?? "",
    courseName: selectedCourse?.name ?? "",
    title: "New Exam",
    date: new Date().toISOString().slice(0, 10),
    startTime: "09:00",
    durationSeconds: 3600,
    location: "",
    instructions: "",
    questions: [],
    totalPoints: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/*  Page content                                                      */
/* ------------------------------------------------------------------ */

function ExamEditorContent() {
  const params = useParams<{ examId: string }>();
  const searchParams = useSearchParams();
  const { user } = useSession();
  const isCreatingExam = params.examId === "new";
  const selectedCourseId = searchParams.get("courseId");
  const [availableCourses, setAvailableCourses] = useState<Course[]>([]);
  const [definition, setDefinition] = useState<ExamDefinition>(() => loadDefinition(params.examId));
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(
    definition.questions[0]?.id ?? null,
  );
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(!isCreatingExam);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [materials, setMaterials] = useState<CourseMaterial[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [materialsError, setMaterialsError] = useState<string | null>(null);

  const selectedCourse = isCreatingExam
    ? availableCourses.find(
      (course) => course.id === selectedCourseId && course.instructorIds.includes(user?.id ?? ""),
    ) ?? null
    : null;

  useEffect(() => {
    let cancelled = false;
    void getVisibleCourses().then((courses) => {
      if (cancelled) return;
      setAvailableCourses(courses);
      if (isCreatingExam) {
        const initialCourse = courses.find((course) => course.id === selectedCourseId) ?? null;
        setDefinition(loadDefinition(params.examId, initialCourse ?? undefined));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isCreatingExam, params.examId, selectedCourseId]);

  useEffect(() => {
    if (isCreatingExam) return;
    let cancelled = false;
    void fetchExamDefinition(params.examId)
      .then((exam) => {
        if (!cancelled && exam) {
          setDefinition(exam);
          setActiveQuestionId(exam.questions[0]?.id ?? null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isCreatingExam, params.examId]);

  /* ---- derived --------------------------------------------------- */
  const totalPoints = useMemo(
    () => computeTotalPoints(definition.questions),
    [definition.questions],
  );
  const activeQuestion = definition.questions.find((q) => q.id === activeQuestionId) ?? null;

  /* ---- metadata -------------------------------------------------- */
  const handleMetaChange = useCallback(
    (meta: Omit<ExamDefinition, "id" | "questions" | "totalPoints" | "createdAt" | "updatedAt">) => {
      setDefinition((prev) => ({ ...prev, ...meta, updatedAt: new Date().toISOString() }));
      setSaved(false);
    },
    [],
  );

  /* ---- questions ------------------------------------------------- */
  const handleQuestionChange = useCallback(
    (updated: ExamQuestion) => {
      setDefinition((prev) => ({
        ...prev,
        questions: prev.questions.map((q) => (q.id === updated.id ? updated : q)),
        updatedAt: new Date().toISOString(),
      }));
      setSaved(false);
    },
    [],
  );

  const handleQuestionAdd = useCallback(
    (q: ExamQuestion) => {
      setDefinition((prev) => ({
        ...prev,
        questions: [...prev.questions, q],
        updatedAt: new Date().toISOString(),
      }));
      setActiveQuestionId(q.id);
      setSaved(false);
    },
    [],
  );

  const handleQuestionDelete = useCallback(() => {
    if (!activeQuestionId) return;
    setDefinition((prev) => {
      const next = prev.questions
        .filter((q) => q.id !== activeQuestionId)
        .map((q, idx) => ({ ...q, order: idx + 1 }));
      // Select the first remaining question or clear
      setActiveQuestionId(next[0]?.id ?? null);
      return { ...prev, questions: next, updatedAt: new Date().toISOString() };
    });
    setSaved(false);
  }, [activeQuestionId]);

  const handleReorder = useCallback((qs: ExamQuestion[]) => {
    setDefinition((prev) => ({ ...prev, questions: qs, updatedAt: new Date().toISOString() }));
    setSaved(false);
  }, []);

  useEffect(() => {
    if (isCreatingExam) return;
    void listCourseMaterials(params.examId).then(setMaterials);
  }, [isCreatingExam, params.examId]);

  const handleMaterialUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || isCreatingExam) return;
      setMaterialsLoading(true);
      setMaterialsError(null);
      const result = await uploadCourseMaterial(params.examId, file);
      if (result) {
        setMaterials((prev) => [...prev, result]);
      } else {
        setMaterialsError("Upload failed. Check file type (PDF, DOCX, PPTX, TXT, MD) and size (max 20 MB).");
      }
      setMaterialsLoading(false);
      event.target.value = "";
    },
    [isCreatingExam, params.examId],
  );

  const handleMaterialDelete = useCallback(
    async (materialId: string) => {
      const ok = await deleteCourseMaterial(params.examId, materialId);
      if (ok) setMaterials((prev) => prev.filter((m) => m.id !== materialId));
    },
    [params.examId],
  );

  /* ---- save (local state + future API) --------------------------- */
  const handleSave = async () => {
    const savedDefinition = await saveExamDefinition(
      isCreatingExam ? null : params.examId,
      {
        courseCode: definition.courseCode,
        courseName: definition.courseName,
        title: definition.title,
        date: definition.date,
        startTime: definition.startTime,
        durationSeconds: definition.durationSeconds,
        location: definition.location,
        instructions: definition.instructions,
        questions: definition.questions,
      },
    );
    if (!savedDefinition) {
      setSaveError("Unable to save the exam definition.");
      return;
    }
    setDefinition(savedDefinition);
    setSaved(true);
    setSaveError(null);
  };

  if (loading) {
    return <div className="panel">Loading exam editor...</div>;
  }

  if (isCreatingExam && !selectedCourse) {
    return (
      <div className="panel" style={{ textAlign: "center", padding: "var(--space-8)" }}>
        <h2 style={{ marginTop: 0 }}>Select an assigned course first</h2>
        <p className="helper-text" style={{ marginBottom: "var(--space-4)" }}>
          Exams can only be created for courses where you are assigned as an instructor.
        </p>
        <Link href="/staff/exams/new" className="button" style={{ textDecoration: "none" }}>
          Choose Course
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* Breadcrumb / back */}
      <div className="flex-between" style={{ marginBottom: "var(--space-6)" }}>
        <div className="flex-row">
          <Link href="/staff" className="button-ghost" style={{ textDecoration: "none" }}>
            ← Back
          </Link>
          <h1 className="page-title" style={{ fontSize: "1.5rem" }}>
            {isCreatingExam ? "Create Exam" : "Edit Exam"}
          </h1>
        </div>
        <div className="flex-row">
          {saved && (
            <span className="badge badge-success" style={{ fontSize: "0.85rem" }}>
              ✓ Saved
            </span>
          )}
          <button className="button" onClick={handleSave}>
            {isCreatingExam ? "Create Exam" : "Save Exam"}
          </button>
        </div>
      </div>

      {saveError && (
        <div className="badge-danger" style={{ padding: "var(--space-3) var(--space-4)", borderRadius: "var(--radius-sm)", marginBottom: "var(--space-4)" }}>
          {saveError}
        </div>
      )}

      {/* Metadata */}
      <ExamMetadataForm
        meta={{
          courseCode: definition.courseCode,
          courseName: definition.courseName,
          title: definition.title,
          date: definition.date,
          startTime: definition.startTime,
          durationSeconds: definition.durationSeconds,
          location: definition.location,
          instructions: definition.instructions,
        }}
        totalPoints={totalPoints}
        questionCount={definition.questions.length}
        onChange={handleMetaChange}
      />

      {/* Course Materials */}
      {!isCreatingExam && (
        <div className="panel" style={{ marginTop: "var(--space-5)", padding: "var(--space-5)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-3)" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "1rem" }}>Course Materials</h2>
              <p style={{ margin: "var(--space-1) 0 0", fontSize: "0.82rem", color: "var(--muted)" }}>
                Upload lecture notes, slides, or reference documents to help the AI grading agents understand the exam context.
              </p>
            </div>
            <label
              style={{
                cursor: materialsLoading ? "not-allowed" : "pointer",
                opacity: materialsLoading ? 0.6 : 1,
              }}
            >
              <span className="button" style={{ pointerEvents: "none" }}>
                {materialsLoading ? "Uploading…" : "+ Upload File"}
              </span>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md"
                style={{ display: "none" }}
                disabled={materialsLoading}
                onChange={handleMaterialUpload}
              />
            </label>
          </div>

          {materialsError && (
            <p style={{ color: "var(--danger-text)", fontSize: "0.82rem", margin: "0 0 var(--space-3)" }}>
              {materialsError}
            </p>
          )}

          {materials.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: "0.85rem", margin: 0 }}>
              No materials uploaded yet.
            </p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "var(--space-2)" }}>
              {materials.map((m) => (
                <li
                  key={m.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-3)",
                    padding: "var(--space-2) var(--space-3)",
                    border: "1px solid var(--border-default)",
                    borderRadius: "var(--radius-sm)",
                    background: "var(--surface-raised)",
                  }}
                >
                  <span style={{ fontSize: "1.1rem" }}>📄</span>
                  <span style={{ flex: 1, fontSize: "0.85rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {m.fileName}
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "var(--muted)", flexShrink: 0 }}>
                    {(m.fileSize / 1024).toFixed(0)} KB
                  </span>
                  <button
                    type="button"
                    className="button-ghost"
                    style={{ fontSize: "0.78rem", color: "var(--danger-text)", flexShrink: 0 }}
                    onClick={() => void handleMaterialDelete(m.id)}
                    aria-label={`Delete ${m.fileName}`}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Question sidebar + editor */}
      <div
        className="authoring-layout"
        style={{ marginTop: "var(--space-5)" }}
      >
        <QuestionListSidebar
          questions={definition.questions}
          activeId={activeQuestionId}
          onSelect={setActiveQuestionId}
          onAdd={handleQuestionAdd}
          onReorder={handleReorder}
        />

        {activeQuestion ? (
          <QuestionEditorPanel
            key={activeQuestion.id}
            question={activeQuestion}
            examId={params.examId}
            onChange={handleQuestionChange}
            onDelete={handleQuestionDelete}
          />
        ) : (
          <div className="panel" style={{ display: "grid", placeItems: "center", minHeight: 300 }}>
            <p className="helper-text">
              {definition.questions.length === 0
                ? "Add a question using the sidebar to get started."
                : "Select a question to edit."}
            </p>
          </div>
        )}
      </div>
    </>
  );
}

export default function ExamEditPage() {
  return (
    <AuthenticatedShell requiredRole="instructor">
      <ExamEditorContent />
    </AuthenticatedShell>
  );
}
