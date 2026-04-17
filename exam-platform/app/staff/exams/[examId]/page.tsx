"use client";

import { use } from "react";
import { redirect } from "next/navigation";
import { MGMT2110_EXAM_ID } from "@/lib/fixtures";

export default function ExamLandingPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const { examId } = use(params);
  if (examId === MGMT2110_EXAM_ID) {
    redirect(`/staff/exams/${examId}/grading`);
  }
  redirect(`/staff/exams/${examId}/proctoring`);
}
