/* ------------------------------------------------------------------ */
/*  ExamSection – labelled group of exam cards                        */
/* ------------------------------------------------------------------ */

import type { Exam } from "@/types";
import { ExamCard } from "./ExamCard";
import { EmptyState } from "@/components/ui";

interface ExamSectionProps {
  title: string;
  exams: Exam[];
  /** Build the link for each card. Return undefined to disable linking. */
  hrefForExam?: (exam: Exam) => string | undefined;
  /** Build extra actions for each card. */
  actionsForExam?: (exam: Exam) => React.ReactNode;
  emptyMessage?: string;
}

export function ExamSection({
  title,
  exams,
  hrefForExam,
  actionsForExam,
  emptyMessage = "No exams in this section.",
}: ExamSectionProps) {
  return (
    <section className="section-group">
      <h2 className="section-title">{title}</h2>
      {exams.length === 0 ? (
        <EmptyState message={emptyMessage} />
      ) : (
        <div className="grid grid-2">
          {exams.map((exam) => (
            <ExamCard
              key={exam.id}
              exam={exam}
              href={hrefForExam?.(exam)}
              actions={actionsForExam?.(exam)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
