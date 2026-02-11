# This is the breakdown of our features.

## Proctoring Module

1. **IndividualProctoringResult(examId: string, studentId: string): IndividualProctoringResult**

Stores and manages proctoring data for a single student during an exam session.

```typescript
  interface ViolationEvidence {
    type: string;           // Type of violation (e.g., "Tab Switch", "Multiple Faces")
    timestamp: string;      // ISO date-time string of occurrence (e.g., "2025-06-14T12:29:21Z")
    urlVideo?: string;      // Optional: URL to video evidence or snapshot
  }
  
  interface IndividualProctoringResult {
    studentId: string;              // Unique identifier for student
    examId: string;                  // Unique identifier for exam
    tabSwitch: integer;             // Number of tab switches detected
    minimizedScreen: integer;      // Number of times the screen was minimized
    keyboardShortcut: integer;     // Number of keyboard shortcuts used
    violations: ViolationEvidence[]; // List of individual violation records
    deviceType: string;          // Device type (e.g., "CHROME (DESKTOP)")
    startTime: string;            // ISO date-time string
    submitTime: string;           // ISO date-time string
  }
```

trustScore is calculated by comparing totalViolation to a given max. number of violations. Adjustment can be made if each violation type carries a different severity (weight)

```typescript
// TBC
  function calculateTrustScore(totalViolation: integer, maxViolations: integer = 10): float {
    // Linear penalty: each violation reduces score equally
    return Math.max(0, 100 - (totalViolation / maxViolations) * 100);
  }
```

2. **ClassProctoringResult(examId: string): ClassProctoringResult**

Aggregates and summarizes proctoring outcomes for an entire class/exam session.

```typescript
  interface ViolationBreakdown {
    tabSwitch: integer;      // Total tab switching incidents in class, sum of each student's
    minimizedScreen: integer;      // Total minimized screen incidents in class, sum of each student's
    keyboardShortcut: integer;       // Total keyboard shortcuts incidents in class, sum of each student's
  }
  
  interface ClassProctoringResult {
    examId: string;                  // Unique identifier for exam
    averageTrustScore: float; // Average of all students' trustScore
    flaggedStudents: integer;         // Count of flagged students (trustScore < 70%)
    totalViolation: integer;          // Total violations in class (sum of all students' totalViolation score)
    mostCommonViolation: string;     // Violation type with the highest count in breakdown, compared from each category
    violationBreakdown: ViolationBreakdown; // Per-category violation count for class
    studentReports: IndividualProctoringResult[];// Array of individual student result
  }
```

## Grading/Analytics Module

1. **IndividualGradingResult(examId: string, studentId: string): IndividualGradingResult**

Stores and manages grading data for a single student during an exam session.

```typescript
interface QuestionGradingResult {
  questionId: string;
  topicId: string;
  score: float;          // Score from AI-grading model
  isCorrect: boolean;
  answerChangeCount: integer;   // Number of answer changes
  flagged: boolean;
}

  // We might also include completionDuration (integer), but not sure how to determine the end-time if the student can revisit questions

interface IndividualGradingResult {
  studentId: string;
  examId: string;
  questionResults: QuestionGradingResult[];
  totalDuration: float;         // In seconds
  flaggedCount: integer;
  strengths: string[];           // Array of topicIds
  weaknesses: string[];          // Array of topicIds
  score: float;                  // Total of each question's score
  scoreDistance: float;          // Total be calculated at class level
  percentile: float;            // To be calculated at class level
  riskLevel: "Low" | "Medium" | "High"; // To be calculated at class level
}
```

2. **ClassGradingResult(examId: string): ClassGradingResult**

Stores and manages grading data for a single student during an entire class/exam session.

```typescript
interface TopicPerformance {
  topicId: string;
  classAverage: float;    // % correct for topic
}

interface ClassGradingResult {
  examId: string;
  students: IndividualGradingResult[];
  topicBreakdown: TopicPerformance[];
  averageScore: float;
  medianScore: float;
  stdDev: float;
  q1Score: float;
  q3Score: float;
  averageDuration: float;
  weakestTopic: TopicPerformance[];
  strongestTopic: TopicPerformance[];
}
```
