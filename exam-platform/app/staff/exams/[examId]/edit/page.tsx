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
import { computeTotalPoints, fetchExamDefinition, saveExamDefinition } from "@/features/exams/exam-service";
import type { Course, ExamDefinition, ExamQuestion } from "@/types";
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
