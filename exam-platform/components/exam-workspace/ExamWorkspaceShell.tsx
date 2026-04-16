"use client";

/* ------------------------------------------------------------------ */
/*  ExamWorkspaceShell – the main exam-taking workspace for students  */
/*                                                                    */
/*  Renders: sidebar question nav + current question + answer input   */
/*  Manages: responses[], flaggedIds[], currentIndex                  */
/* ------------------------------------------------------------------ */

import { useCallback, useMemo, useState } from "react";
import type { ExamDefinition, QuestionResponse } from "@/types";
import { QuestionNavigator } from "./QuestionNavigator";
import { AnswerInput } from "./AnswerInputs";
import {
  buildNavItems,
  getResponseForQuestion,
  upsertResponse,
} from "@/features/exams/exam-service";

interface ExamWorkspaceShellProps {
  definition: ExamDefinition;
  /** Called whenever the response list changes (for draft persistence). */
  onResponsesChange?: (responses: QuestionResponse[]) => void;
  /** Called when the student clicks the submit button. */
  onSubmit?: (responses: QuestionResponse[]) => void;
}

export function ExamWorkspaceShell({
  definition,
  onResponsesChange,
  onSubmit,
}: ExamWorkspaceShellProps) {
  const [responses, setResponses] = useState<QuestionResponse[]>([]);
  const [flaggedIds, setFlaggedIds] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const questions = definition.questions;
  const currentQuestion = questions[currentIndex] ?? null;

  /* ---- nav items ------------------------------------------------- */
  const navItems = useMemo(
    () => buildNavItems(questions, responses, flaggedIds),
    [questions, responses, flaggedIds],
  );

  /* ---- current response value ------------------------------------ */
  const currentResponse = currentQuestion
    ? getResponseForQuestion(responses, currentQuestion.id)
    : undefined;
  const currentValue: string | string[] =
    currentResponse?.value ?? (currentQuestion?.type === "mcq" ? [] : "");

  /* ---- answer change handler ------------------------------------- */
  const handleAnswerChange = useCallback(
    (value: string | string[]) => {
      if (!currentQuestion) return;
      const resp: QuestionResponse = {
        questionId: currentQuestion.id,
        questionType: currentQuestion.type,
        value,
        answeredAt: new Date().toISOString(),
      };
      const next = upsertResponse(responses, resp);
      setResponses(next);
      onResponsesChange?.(next);
    },
    [currentQuestion, responses, onResponsesChange],
  );

  /* ---- flag toggle ----------------------------------------------- */
  const toggleFlag = useCallback(() => {
    if (!currentQuestion) return;
    setFlaggedIds((prev) =>
      prev.includes(currentQuestion.id)
        ? prev.filter((id) => id !== currentQuestion.id)
        : [...prev, currentQuestion.id],
    );
  }, [currentQuestion]);

  /* ---- navigation ------------------------------------------------ */
  const goPrev = () => setCurrentIndex((i) => Math.max(0, i - 1));
  const goNext = () => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1));

  const isFlagged = currentQuestion ? flaggedIds.includes(currentQuestion.id) : false;

  return (
    <div className="workspace-layout">
      {/* Left: navigator */}
      <QuestionNavigator
        items={navItems}
        currentIndex={currentIndex}
        onNavigate={setCurrentIndex}
      />

      {/* Right: question + answer */}
      <div className="workspace-main">
        {currentQuestion ? (
          <>
            {/* Question header */}
            <div className="workspace-question-header">
              <div>
                <h3 style={{ margin: 0 }}>
                  Q{currentQuestion.order}. {currentQuestion.title}
                </h3>
                <span className="helper-text">
                  {currentQuestion.points} point{currentQuestion.points !== 1 ? "s" : ""}
                  {currentQuestion.required ? " · Required" : ""}
                </span>
              </div>
              <button
                className={isFlagged ? "button-secondary" : "button-ghost"}
                style={{ fontSize: "0.85rem" }}
                onClick={toggleFlag}
              >
                {isFlagged ? "🚩 Flagged" : "🏳️ Flag"}
              </button>
            </div>

            {/* Prompt */}
            <div className="workspace-prompt">
              <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{currentQuestion.prompt}</p>
            </div>

            {/* Answer */}
            <div className="workspace-answer">
              <AnswerInput
                question={currentQuestion}
                value={currentValue}
                onChange={handleAnswerChange}
              />
            </div>

            {/* Navigation footer */}
            <div className="workspace-footer">
              <button
                className="button-ghost"
                onClick={goPrev}
                disabled={currentIndex === 0}
              >
                ← Previous
              </button>
              <span className="helper-text">
                {currentIndex + 1} of {questions.length}
              </span>
              {currentIndex < questions.length - 1 ? (
                <button className="button" onClick={goNext}>
                  Next →
                </button>
              ) : (
                <button
                  className="button"
                  style={{ background: "var(--success-text)" }}
                  onClick={() => onSubmit?.(responses)}
                >
                  ✅ Submit Exam
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="panel" style={{ display: "grid", placeItems: "center", minHeight: 200 }}>
            <p className="helper-text">No questions available.</p>
          </div>
        )}
      </div>
    </div>
  );
}
