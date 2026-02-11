export const questionAnalysisData = [
  {
    question: "Q1",
    correct: 85,
    difficulty: "Easy",
    topic: "Kinematics",
    summary:
      "85% correct. Students performed well on basic velocity calculations.",
    discriminationIndex: 0.72,
    discriminationStatus: "Good",
    commonWrongAnswers: [
      {
        option: "B",
        percentage: 8,
        reason: "Confused velocity with acceleration",
      },
      { option: "C", percentage: 5, reason: "Unit conversion error" },
      { option: "D", percentage: 2, reason: "Calculation mistake" },
    ],
    aiInsights:
      "Question clearly distinguishes between high and low performers. Consider adding more complex scenarios for advanced students.",
  },
  {
    question: "Q2",
    correct: 72,
    difficulty: "Medium",
    topic: "Forces",
    summary: "72% correct. Some confusion with free body diagrams.",
    discriminationIndex: 0.58,
    discriminationStatus: "Acceptable",
    commonWrongAnswers: [
      {
        option: "A",
        percentage: 15,
        reason: "Missed friction force in diagram",
      },
      {
        option: "C",
        percentage: 10,
        reason: "Incorrect direction of normal force",
      },
      { option: "D", percentage: 3, reason: "Sign error in calculation" },
    ],
    aiInsights:
      "Students struggle with multi-force scenarios. Recommend more practice with free body diagrams before similar assessments.",
  },
  {
    question: "Q3",
    correct: 45,
    difficulty: "Hard",
    topic: "Energy",
    summary:
      "45% correct. Major difficulty with conservation of energy applications.",
    discriminationIndex: 0.65,
    discriminationStatus: "Good",
    commonWrongAnswers: [
      {
        option: "B",
        percentage: 32,
        reason: "Confused kinetic and potential energy",
      },
      {
        option: "C",
        percentage: 18,
        reason: "Forgot to account for energy losses",
      },
      { option: "D", percentage: 5, reason: "Arithmetic error" },
    ],
    aiInsights:
      "High discrimination but low success rate indicates appropriate difficulty. Consider providing energy transformation examples in instruction.",
  },
  {
    question: "Q4",
    correct: 38,
    difficulty: "Hard",
    topic: "Waves",
    summary:
      "38% correct. Top misconception: Confusing wavelength with frequency.",
    discriminationIndex: 0.42,
    discriminationStatus: "Poor",
    commonWrongAnswers: [
      {
        option: "A",
        percentage: 35,
        reason: "Used frequency formula instead of wavelength",
      },
      {
        option: "C",
        percentage: 22,
        reason: "Incorrect wave speed assumption",
      },
      { option: "D", percentage: 5, reason: "Unit error" },
    ],
    aiInsights:
      "Poor discrimination suggests question may be ambiguous or covers untaught material. Consider revising question wording or reviewing prerequisite concepts.",
  },
  {
    question: "Q5",
    correct: 91,
    difficulty: "Easy",
    topic: "Electricity",
    summary: "91% correct. Excellent performance on basic circuit analysis.",
    discriminationIndex: 0.35,
    discriminationStatus: "Poor",
    commonWrongAnswers: [
      { option: "B", percentage: 5, reason: "Misread circuit diagram" },
      { option: "C", percentage: 3, reason: "Calculation error" },
      { option: "D", percentage: 1, reason: "Random guess" },
    ],
    aiInsights:
      "High success rate but poor discrimination—question may be too easy. Consider increasing complexity for better assessment value.",
  },
  {
    question: "Q6",
    correct: 67,
    difficulty: "Medium",
    topic: "Magnetism",
    summary: "67% correct. Some difficulty with magnetic field directions.",
    discriminationIndex: 0.61,
    discriminationStatus: "Acceptable",
    commonWrongAnswers: [
      {
        option: "A",
        percentage: 18,
        reason: "Incorrect right-hand rule application",
      },
      {
        option: "C",
        percentage: 12,
        reason: "Confused magnetic and electric fields",
      },
      { option: "D", percentage: 3, reason: "Magnitude calculation error" },
    ],
    aiInsights:
      "Moderate discrimination and success rate. Students need more practice with right-hand rule and field direction concepts.",
  },
  {
    question: "Q7",
    correct: 29,
    difficulty: "Hard",
    topic: "Thermodynamics",
    summary: "29% correct. Top misconception: Confusing temperature with heat.",
    discriminationIndex: 0.58,
    discriminationStatus: "Acceptable",
    commonWrongAnswers: [
      {
        option: "B",
        percentage: 41,
        reason: "Used temperature change instead of heat transfer",
      },
      {
        option: "C",
        percentage: 25,
        reason: "Incorrect specific heat capacity",
      },
      { option: "D", percentage: 5, reason: "Unit conversion error" },
    ],
    aiInsights:
      "Low success rate with acceptable discrimination. Core concept confusion suggests need for fundamental review before assessment.",
  },
  {
    question: "Q8",
    correct: 78,
    difficulty: "Medium",
    topic: "Optics",
    summary: "78% correct. Good understanding of lens calculations.",
    discriminationIndex: 0.69,
    discriminationStatus: "Good",
    commonWrongAnswers: [
      { option: "A", percentage: 12, reason: "Sign convention error" },
      {
        option: "C",
        percentage: 8,
        reason: "Confused object and image distances",
      },
      { option: "D", percentage: 2, reason: "Arithmetic mistake" },
    ],
    aiInsights:
      "Well-designed question with good discrimination and moderate difficulty. Effective for assessing student understanding.",
  },
];
