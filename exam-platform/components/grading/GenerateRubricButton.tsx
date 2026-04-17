"use client";

/* ------------------------------------------------------------------ */
/*  GenerateRubricButton – triggers AI rubric generation              */
/* ------------------------------------------------------------------ */

import { useState } from "react";
import { generateRubric } from "@/features/grading/grading-service";
import type { StructuredRubric } from "@/types";

interface GenerateRubricButtonProps {
  examId: string;
  questionId: string;
  questionPrompt: string;
  questionType: string;
  points: number;
  onGenerated: (rubric: StructuredRubric) => void;
}

export function GenerateRubricButton({
  examId,
  questionId,
  questionPrompt,
  questionType,
  points,
  onGenerated,
}: GenerateRubricButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const { rubric } = await generateRubric({
        examId,
        questionId,
        questionPrompt,
        questionType,
        points,
      });
      onGenerated(rubric);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate rubric");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
      <button
        type="button"
        className="button"
        onClick={handleGenerate}
        disabled={loading}
        style={{ fontSize: "0.85rem" }}
      >
        {loading ? "Generating…" : "🤖 Generate Rubric"}
      </button>
      {error && (
        <span style={{ fontSize: "0.8rem", color: "var(--danger-text)" }}>{error}</span>
      )}
    </div>
  );
}
