/* ------------------------------------------------------------------ */
/*  Exam fixtures – seeded data for the MVP                           */
/* ------------------------------------------------------------------ */

import type { Exam, ExamModule, ExamDefinition } from "@/types";
import { DEMO_EXAM_DURATION_SECONDS } from "@/lib/constants";
import { COMP1023_EXAM } from "./comp1023";
import { MGMT2110_EXAM } from "./mgmt2110";

/** The seeded 1-minute demo current exam. */
export const DEMO_CURRENT_EXAM: Exam = {
  id: "exam-current-001",
  courseCode: "COMP3511",
  courseName: "Operating Systems",
  title: "Midterm Examination",
  date: "2026-04-15",
  startTime: "14:00",
  durationSeconds: DEMO_EXAM_DURATION_SECONDS,
  location: "LT-A",
  status: "current",
  studentCount: 48,
  semesterId: "2025-26-spring",
};

export const UPCOMING_EXAMS: Exam[] = [
  {
    id: "exam-up-001",
    courseCode: "COMP4321",
    courseName: "Search Engines",
    title: "Final Examination",
    date: "2026-05-10",
    startTime: "09:30",
    durationSeconds: 7200,
    location: "Hall A",
    status: "upcoming",
    studentCount: 65,
    semesterId: "2025-26-spring",
  },
  {
    id: "exam-up-002",
    courseCode: "COMP2012",
    courseName: "OOP & Data Structures",
    title: "Midterm Quiz 2",
    date: "2026-04-28",
    startTime: "11:00",
    durationSeconds: 3600,
    location: "LT-J",
    status: "upcoming",
    studentCount: 120,
    semesterId: "2025-26-spring",
  },
];

export const PAST_EXAMS: Exam[] = [
  {
    id: "exam-past-001",
    courseCode: "COMP3511",
    courseName: "Operating Systems",
    title: "Quiz 1",
    date: "2026-03-15",
    startTime: "14:00",
    durationSeconds: 1800,
    location: "LT-A",
    status: "past",
    studentCount: 48,
    semesterId: "2025-26-spring",
  },
  {
    id: "exam-past-002",
    courseCode: "COMP2012",
    courseName: "OOP & Data Structures",
    title: "Midterm Quiz 1",
    date: "2026-02-20",
    startTime: "11:00",
    durationSeconds: 3600,
    location: "LT-J",
    status: "past",
    studentCount: 118,
    semesterId: "2025-26-spring",
  },
  {
    id: "exam-past-003",
    courseCode: "COMP3511",
    courseName: "Operating Systems",
    title: "Final Examination",
    date: "2025-12-18",
    startTime: "09:00",
    durationSeconds: 7200,
    location: "LT-A",
    status: "past",
    studentCount: 52,
    semesterId: "2025-26-fall",
  },
];

/** All exams as a flat list. */
export const ALL_EXAMS: Exam[] = [
  DEMO_CURRENT_EXAM,
  COMP1023_EXAM,
  MGMT2110_EXAM,
  ...UPCOMING_EXAMS,
  ...PAST_EXAMS,
];

/** Module definitions for the past-exam detail view. */
export const EXAM_MODULES: ExamModule[] = [
  {
    key: "proctoring",
    label: "Proctoring",
    enabled: true,
    description: "AI-powered exam integrity monitoring",
  },
  {
    key: "grading",
    label: "Grading",
    enabled: true,
    description: "AI-powered multi-agent grading workflows",
  },
  {
    key: "analytics",
    label: "Analytics",
    enabled: true,
    description: "Performance analytics and insights",
  },
];

/* ------------------------------------------------------------------ */
/*  Demo Exam Definition – seeded questions for exam-up-001           */
/* ------------------------------------------------------------------ */

export const DEMO_EXAM_DEFINITION: ExamDefinition = {
  id: "exam-up-001",
  courseCode: "COMP4321",
  courseName: "Search Engines",
  title: "Final Examination",
  date: "2026-05-10",
  startTime: "09:30",
  durationSeconds: 7200,
  location: "Hall A",
  instructions:
    "Answer ALL questions. Calculators are NOT permitted. Write clearly and concisely.",
  totalPoints: 100,
  createdAt: "2026-04-01T10:00:00Z",
  updatedAt: "2026-04-20T14:30:00Z",
  questions: [
    /* Q1 – MCQ */
    {
      id: "q-mcq-001",
      order: 1,
      type: "mcq",
      title: "TF-IDF Weighting",
      prompt:
        "Which of the following best describes the purpose of inverse document frequency (IDF) in TF-IDF?",
      points: 10,
      required: true,
      options: [
        {
          id: "opt-a",
          label: "It normalises term frequency by document length.",
          isCorrect: false,
        },
        {
          id: "opt-b",
          label:
            "It reduces the weight of terms that appear in many documents.",
          isCorrect: true,
        },
        {
          id: "opt-c",
          label: "It increases the weight of rare terms in a single document.",
          isCorrect: false,
        },
        {
          id: "opt-d",
          label: "It converts term counts into binary indicators.",
          isCorrect: false,
        },
      ],
      allowMultiple: false,
    },

    /* Q2 – Short Answer */
    {
      id: "q-sa-001",
      order: 2,
      type: "short_answer",
      title: "Precision vs Recall",
      prompt:
        "Define precision and recall in the context of information retrieval. Give one scenario where high precision is preferred over high recall.",
      points: 15,
      required: true,
      maxLength: 500,
      placeholder: "Type your answer here…",
    },

    /* Q3 – Long Answer */
    {
      id: "q-la-001",
      order: 3,
      type: "long_answer",
      title: "Web Crawler Architecture",
      prompt:
        "Describe the architecture of a distributed web crawler. Explain how politeness policies and duplicate detection are implemented in practice.",
      points: 20,
      required: true,
      expectedLengthHint: "300-500 words",
    },

    /* Q4 – Essay */
    {
      id: "q-essay-001",
      order: 4,
      type: "essay",
      title: "Ethics of Search Engine Ranking",
      prompt:
        "Discuss the ethical implications of personalised search engine ranking. Consider privacy, filter bubbles, and the potential for algorithmic bias.",
      points: 25,
      required: true,
      expectedLengthHint: "500-800 words",
    },

    /* Q5 – Coding */
    {
      id: "q-code-001",
      order: 5,
      type: "coding",
      title: "Inverted Index Construction",
      prompt:
        "Implement a function `build_inverted_index(docs)` that takes a list of (doc_id, text) tuples and returns a dictionary mapping each term to a sorted list of document IDs containing that term. Lowercase all text and split on whitespace.",
      points: 20,
      required: true,
      language: "python",
      starterCode: `def build_inverted_index(docs: list[tuple[int, str]]) -> dict[str, list[int]]:
    \"\"\"Build an inverted index from a list of (doc_id, text) tuples.\"\"\"
    # TODO: implement
    pass
`,
      constraints:
        "Time complexity should be O(N) where N is the total number of words across all documents.",
    },

    /* Q6 – Mathematics */
    {
      id: "q-math-001",
      order: 6,
      type: "mathematics",
      title: "PageRank Computation",
      prompt:
        "Given a web graph with 3 pages A, B, C where A→B, A→C, B→C, and C→A, compute the PageRank vector after one iteration starting from a uniform distribution. Use a damping factor d = 0.85.",
      points: 10,
      required: true,
      answerFormatHint:
        "Express your answer as a vector [PR(A), PR(B), PR(C)] rounded to 4 decimal places.",
    },
  ],
};
