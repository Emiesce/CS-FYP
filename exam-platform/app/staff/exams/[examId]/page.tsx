"use client";

import { use } from "react";
import { redirect } from "next/navigation";

export default function ExamLandingPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const { examId } = use(params);
  redirect(`/staff/exams/${examId}/proctoring`);
}
