import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import StudentSelect from "./ui/StudentSelect";
import { Progress } from "./ui/progress";
import { Badge } from "./ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";
import { Button } from "./ui/button";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { LucideIcon } from "lucide-react";
import {
  User,
  Target,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Clock,
  Flag,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Eye,
  AlertCircle,
} from "lucide-react";
import React, { memo, useMemo, useState, ReactNode } from "react";

const studentsData = [
  {
    id: "student1",
    name: "Emma Johnson",
    score: 18.5,
    timeSpent: 38,
    percentile: 92,
    isOutlier: false,
    riskLevel: "Low",
    strengths: ["Kinematics", "Electricity", "Optics"],
    weaknesses: ["Thermodynamics", "Waves"],
    questionBehavior: [
      {
        question: "Q1",
        timeSpent: 3.2,
        correct: true,
        flagged: false,
        attempts: 1,
        finalAnswer: "A",
      },
      {
        question: "Q2",
        timeSpent: 4.1,
        correct: true,
        flagged: false,
        attempts: 1,
        finalAnswer: "B",
      },
      {
        question: "Q3",
        timeSpent: 6.8,
        correct: false,
        flagged: true,
        attempts: 3,
        finalAnswer: "C",
        originalAnswer: "A",
        error: "Incorrect application of conservation of energy",
        impact: "High",
      },
      {
        question: "Q4",
        timeSpent: 5.2,
        correct: true,
        flagged: false,
        attempts: 2,
        finalAnswer: "D",
      },
      {
        question: "Q5",
        timeSpent: 2.1,
        correct: true,
        flagged: false,
        attempts: 1,
        finalAnswer: "A",
      },
      {
        question: "Q6",
        timeSpent: 3.9,
        correct: true,
        flagged: false,
        attempts: 1,
        finalAnswer: "C",
      },
      {
        question: "Q7",
        timeSpent: 8.4,
        correct: false,
        flagged: true,
        attempts: 4,
        finalAnswer: "B",
        originalAnswer: "D",
        error: "Wrong formula for heat capacity",
        impact: "Medium",
      },
      {
        question: "Q8",
        timeSpent: 4.3,
        correct: true,
        flagged: false,
        attempts: 1,
        finalAnswer: "A",
      },
    ],
  },
  {
    id: "student2",
    name: "Michael Chen",
    score: 15.2,
    timeSpent: 45,
    percentile: 68,
    isOutlier: false,
    riskLevel: "Medium",
    strengths: ["Forces", "Magnetism"],
    weaknesses: ["Energy", "Waves", "Thermodynamics"],
    questionBehavior: [
      {
        question: "Q1",
        timeSpent: 4.1,
        correct: true,
        flagged: false,
        attempts: 1,
        finalAnswer: "A",
      },
      {
        question: "Q2",
        timeSpent: 5.2,
        correct: true,
        flagged: false,
        attempts: 2,
        finalAnswer: "B",
      },
      {
        question: "Q3",
        timeSpent: 7.3,
        correct: false,
        flagged: true,
        attempts: 2,
        finalAnswer: "B",
        originalAnswer: "A",
        error: "Calculation error in kinetic energy",
        impact: "High",
      },
      {
        question: "Q4",
        timeSpent: 9.1,
        correct: false,
        flagged: true,
        attempts: 5,
        finalAnswer: "A",
        originalAnswer: "C",
        error: "Misunderstood wave interference",
        impact: "High",
      },
      {
        question: "Q5",
        timeSpent: 3.2,
        correct: true,
        flagged: false,
        attempts: 1,
        finalAnswer: "A",
      },
      {
        question: "Q6",
        timeSpent: 4.8,
        correct: true,
        flagged: false,
        attempts: 1,
        finalAnswer: "C",
      },
      {
        question: "Q7",
        timeSpent: 8.9,
        correct: false,
        flagged: true,
        attempts: 3,
        finalAnswer: "B",
        originalAnswer: "D",
        error: "Incorrect temperature conversion",
        impact: "Medium",
      },
      {
        question: "Q8",
        timeSpent: 2.4,
        correct: true,
        flagged: false,
        attempts: 1,
        finalAnswer: "A",
      },
    ],
  },
  {
    id: "student3",
    name: "Sarah Williams",
    score: 12.8,
    timeSpent: 52,
    percentile: 45,
    isOutlier: false,
    riskLevel: "Medium",
    strengths: ["Kinematics", "Electricity"],
    weaknesses: ["Energy", "Waves", "Thermodynamics", "Forces"],
    questionBehavior: [
      {
        question: "Q1",
        timeSpent: 5.1,
        correct: true,
        flagged: false,
        attempts: 2,
        finalAnswer: "A",
      },
      {
        question: "Q2",
        timeSpent: 8.2,
        correct: false,
        flagged: true,
        attempts: 4,
        finalAnswer: "A",
        originalAnswer: "B",
        error: "Incorrect free body diagram",
        impact: "High",
      },
      {
        question: "Q3",
        timeSpent: 9.4,
        correct: false,
        flagged: true,
        attempts: 3,
        finalAnswer: "B",
        originalAnswer: "C",
        error: "Mixed up potential and kinetic energy",
        impact: "High",
      },
      {
        question: "Q4",
        timeSpent: 7.8,
        correct: false,
        flagged: true,
        attempts: 2,
        finalAnswer: "C",
        originalAnswer: "A",
        error: "Wrong wavelength calculation",
        impact: "Medium",
      },
      {
        question: "Q5",
        timeSpent: 3.1,
        correct: true,
        flagged: false,
        attempts: 1,
        finalAnswer: "A",
      },
      {
        question: "Q6",
        timeSpent: 6.7,
        correct: false,
        flagged: false,
        attempts: 2,
        finalAnswer: "A",
        originalAnswer: "C",
        error: "Confused magnetic field direction",
        impact: "Medium",
      },
      {
        question: "Q7",
        timeSpent: 10.2,
        correct: false,
        flagged: true,
        attempts: 5,
        finalAnswer: "B",
        originalAnswer: "D",
        error: "Incorrect ideal gas law application",
        impact: "High",
      },
      {
        question: "Q8",
        timeSpent: 1.5,
        correct: true,
        flagged: false,
        attempts: 1,
        finalAnswer: "A",
      },
    ],
  },
  {
    id: "student4",
    name: "David Park",
    score: 8.3,
    timeSpent: 63,
    percentile: 15,
    isOutlier: true,
    riskLevel: "High",
    strengths: ["Electricity"],
    weaknesses: [
      "Energy",
      "Waves",
      "Thermodynamics",
      "Forces",
      "Kinematics",
      "Magnetism",
    ],
    questionBehavior: [
      {
        question: "Q1",
        timeSpent: 8.5,
        correct: false,
        flagged: true,
        attempts: 6,
        finalAnswer: "B",
        originalAnswer: "A",
        error: "Fundamental velocity concept confusion",
        impact: "High",
      },
      {
        question: "Q2",
        timeSpent: 9.8,
        correct: false,
        flagged: true,
        attempts: 4,
        finalAnswer: "D",
        originalAnswer: "A",
        error: "Unable to identify forces correctly",
        impact: "High",
      },
      {
        question: "Q3",
        timeSpent: 12.1,
        correct: false,
        flagged: true,
        attempts: 7,
        finalAnswer: "C",
        originalAnswer: "A",
        error: "No understanding of energy conservation",
        impact: "High",
      },
      {
        question: "Q4",
        timeSpent: 11.3,
        correct: false,
        flagged: true,
        attempts: 5,
        finalAnswer: "B",
        originalAnswer: "D",
        error: "Complete misunderstanding of wave concepts",
        impact: "High",
      },
      {
        question: "Q5",
        timeSpent: 4.2,
        correct: true,
        flagged: false,
        attempts: 2,
        finalAnswer: "A",
      },
      {
        question: "Q6",
        timeSpent: 7.9,
        correct: false,
        flagged: true,
        attempts: 3,
        finalAnswer: "B",
        originalAnswer: "C",
        error: "Magnetic field direction confusion",
        impact: "High",
      },
      {
        question: "Q7",
        timeSpent: 8.1,
        correct: false,
        flagged: true,
        attempts: 4,
        finalAnswer: "D",
        originalAnswer: "A",
        error: "No grasp of thermodynamic principles",
        impact: "High",
      },
      {
        question: "Q8",
        timeSpent: 1.1,
        correct: false,
        flagged: false,
        attempts: 1,
        finalAnswer: "D",
        error: "Rushed through without understanding",
        impact: "Medium",
      },
    ],
  },
  {
    id: "student5",
    name: "Lisa Zhang",
    score: 6.9,
    timeSpent: 71,
    percentile: 8,
    isOutlier: true,
    riskLevel: "High",
    strengths: [],
    weaknesses: [
      "Energy",
      "Waves",
      "Thermodynamics",
      "Forces",
      "Kinematics",
      "Magnetism",
      "Optics",
    ],
    questionBehavior: [
      {
        question: "Q1",
        timeSpent: 12.3,
        correct: false,
        flagged: true,
        attempts: 8,
        finalAnswer: "C",
        originalAnswer: "A",
        error: "Cannot distinguish basic motion concepts",
        impact: "High",
      },
      {
        question: "Q2",
        timeSpent: 14.1,
        correct: false,
        flagged: true,
        attempts: 6,
        finalAnswer: "C",
        originalAnswer: "B",
        error: "Fundamental misunderstanding of forces",
        impact: "High",
      },
      {
        question: "Q3",
        timeSpent: 13.8,
        correct: false,
        flagged: true,
        attempts: 7,
        finalAnswer: "D",
        originalAnswer: "A",
        error: "No energy concept foundation",
        impact: "High",
      },
      {
        question: "Q4",
        timeSpent: 11.9,
        correct: false,
        flagged: true,
        attempts: 5,
        finalAnswer: "C",
        originalAnswer: "B",
        error: "Wave physics completely unclear",
        impact: "High",
      },
      {
        question: "Q5",
        timeSpent: 6.7,
        correct: false,
        flagged: true,
        attempts: 3,
        finalAnswer: "B",
        originalAnswer: "A",
        error: "Basic circuit analysis errors",
        impact: "High",
      },
      {
        question: "Q6",
        timeSpent: 8.4,
        correct: false,
        flagged: true,
        attempts: 4,
        finalAnswer: "D",
        originalAnswer: "A",
        error: "Magnetism concepts not understood",
        impact: "High",
      },
      {
        question: "Q7",
        timeSpent: 3.2,
        correct: false,
        flagged: false,
        attempts: 1,
        finalAnswer: "C",
        error: "Gave up on thermodynamics",
        impact: "High",
      },
      {
        question: "Q8",
        timeSpent: 0.6,
        correct: false,
        flagged: false,
        attempts: 1,
        finalAnswer: "B",
        error: "Random guessing due to time pressure",
        impact: "Medium",
      },
    ],
  },
];

const topicPerformanceData = (student: (typeof studentsData)[0]) => [
  {
    topic: "Kinematics",
    student: student.strengths.includes("Kinematics")
      ? 85
      : student.weaknesses.includes("Kinematics")
        ? 25
        : 45,
    classAvg: 72,
  },
  {
    topic: "Forces",
    student: student.strengths.includes("Forces")
      ? 88
      : student.weaknesses.includes("Forces")
        ? 25
        : 70,
    classAvg: 68,
  },
  {
    topic: "Energy",
    student: student.strengths.includes("Energy") ? 90 : 20,
    classAvg: 52,
  },
  {
    topic: "Waves",
    student: student.strengths.includes("Waves") ? 85 : 15,
    classAvg: 41,
  },
  {
    topic: "Electricity",
    student: student.strengths.includes("Electricity")
      ? 95
      : student.weaknesses.includes("Electricity")
        ? 30
        : 60,
    classAvg: 78,
  },
  {
    topic: "Magnetism",
    student: student.strengths.includes("Magnetism")
      ? 92
      : student.weaknesses.includes("Magnetism")
        ? 25
        : 65,
    classAvg: 63,
  },
  {
    topic: "Thermodynamics",
    student: student.strengths.includes("Thermodynamics") ? 80 : 10,
    classAvg: 34,
  },
  {
    topic: "Optics",
    student: student.strengths.includes("Optics")
      ? 88
      : student.weaknesses.includes("Optics")
        ? 20
        : 65,
    classAvg: 71,
  },
];

type Variant = "danger" | "warning" | "success" | "info";

type StatisticCardProps = {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  //variant?: Variant;
};

const variantStyles = {
  danger: "bg-red-100",
  success: "bg-green-100",
  info: "bg-blue-200",
  warning: "bg-yellow-100",
};

const StatisticCard = memo(function StatisticCard({
  title,
  value,
  description,
  icon: Icon,
}: StatisticCardProps) {
  return (
    <Card className="flex-1">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>

        {Icon && <Icon className="h-4 w-4" />}
      </CardHeader>

      <CardContent>
        <div className="text-2xl font-semibold ">{value}</div>

        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );
});

export function StudentAnalytics() {
  const studentOptions = studentsData.map((student) => ({
    value: student.id,
    label: `${student.name} – ${student.riskLevel} Risk – ${student.score}/20`,
  }));

  const [selectedStudent, setSelectedStudent] = useState(studentsData[0]);
  const [expandedQuestions, setExpandedQuestions] = useState<string[]>([]);

  const performanceData = topicPerformanceData(selectedStudent);
  const classAverage = 14.5;
  const scoreDifference = selectedStudent.score - classAverage;

  const toggleQuestion = (questionId: string) => {
    setExpandedQuestions((prev) =>
      prev.includes(questionId)
        ? prev.filter((id) => id !== questionId)
        : [...prev, questionId],
    );
  };

  const getRiskLevelColor = (riskLevel: string) => {
    switch (riskLevel) {
      case "High":
        return "text-red-600 bg-red-50 border-red-200";
      case "Medium":
        return "text-yellow-600 bg-yellow-50 border-yellow-200";
      case "Low":
        return "text-green-600 bg-green-50 border-green-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const getTimeSpentColor = (timeSpent: number, avgTime: number = 5) => {
    if (timeSpent > avgTime * 2) return "text-red-600";
    if (timeSpent > avgTime * 1.5) return "text-yellow-600";
    return "text-green-600";
  };

  const statisticValues: {
    title: string;
    value: string | number;
    description?: string;
    icon: LucideIcon;
    variant?: Variant;
  }[] = [
    {
      title: "Student Score",
      value: `${selectedStudent.score}/20`,
      description: `${scoreDifference > 0 ? "+" : ""}${scoreDifference.toFixed(1)} vs class avg`,
      icon: User,
    },
    {
      title: "Risk Level",
      value: selectedStudent.riskLevel,
      description: "Based on performance analysis",
      icon: AlertTriangle,
    },
    {
      title: "Percentile Rank",
      value: `${selectedStudent.percentile}%`,
      description: `Better than ${selectedStudent.percentile}% of class`,
      icon: Target,
    },
    {
      title: "Time Spent",
      value: `${selectedStudent.timeSpent} min`,
      description:
        selectedStudent.timeSpent > 42
          ? "Above class average"
          : "Below class average",
      icon: Clock,
    },
    {
      title: "Questions Flagged",
      value: selectedStudent.questionBehavior.filter((q) => q.flagged).length,
      description: "Out of 8 total questions",
      icon: Flag,
    },
  ];

  return (
    <div className="flex-1 p-8">
      {/* Student Selector -> change to input? */}
      <Card>
        <CardHeader>
          <CardTitle>Select Student</CardTitle>
          <CardDescription>
            Choose a student to view their individual performance analysis.
            Students at risk are highlighted.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* <Select
            value={selectedStudent.id}
            onValueChange={(value: string) =>
              setSelectedStudent(
                studentsData.find((s) => s.id === value) || studentsData[0],
              )
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>

            <SelectContent className="w-full">
              {studentsData.map((student) => (
                <SelectItem
                  key={student.id}
                  value={student.id}
                  className="bg-blue-200 w-full py-1 px-2"
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      {student.isOutlier && (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      )}
                      <span>{student.name}</span>
                      <Badge
                        variant="outline"
                        className={`text-xs ${getRiskLevelColor(student.riskLevel)}`}
                      >
                        {student.riskLevel} Risk
                      </Badge>
                    </div>
                    <span className="text-sm">{student.score}/20</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select> */}

          <StudentSelect
            value={selectedStudent.id}
            onChange={(value) =>
              setSelectedStudent(
                studentsData.find((s) => s.id === value) ?? studentsData[0],
              )
            }
            options={studentOptions}
          />

          {selectedStudent.isOutlier && (
            <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <span className="font-medium text-red-800">
                  At-Risk Student Identified
                </span>
              </div>
              <p className="text-sm text-red-700">
                This student scored significantly below class average and may
                need additional support. Review behavioral patterns and consider
                intervention strategies.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Enhanced Student Overview */}
      <div className="flex flex-wrap gap-6 justify-around pb-6 pt-6">
        {statisticValues.map((stat) => (
          <StatisticCard
            key={stat.title}
            title={stat.title}
            value={stat.value}
            description={stat.description}
            icon={stat.icon}
          />
        ))}
      </div>

      {/* Performance Comparison Charts */}
      <div className="flex flex-wrap gap-6 justify-around pb-6">
        {/* Topic Performance Radar */}
        <Card className="flex-1">
          <CardHeader>
            <CardTitle>Topic Performance Comparison</CardTitle>
            <CardDescription>
              Student performance vs class average by topic
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={performanceData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="topic" />
                <PolarRadiusAxis angle={90} domain={[0, 100]} />
                <Radar
                  name="Student"
                  dataKey="student"
                  stroke="#8884d8"
                  fill="#8884d8"
                  fillOpacity={0.3}
                />
                <Radar
                  name="Class Average"
                  dataKey="classAvg"
                  stroke="#82ca9d"
                  fill="#82ca9d"
                  fillOpacity={0.3}
                />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Topic Performance Bar Chart */}
        <Card className="flex-1">
          <CardHeader>
            <CardTitle>Detailed Topic Breakdown</CardTitle>
            <CardDescription>
              Side-by-side comparison with class performance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="topic"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis />
                <Tooltip />
                <Bar name="Student" dataKey="student" fill="#8884d8" />
                <Bar name="Class Avg" dataKey="classAvg" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Strengths and Weaknesses */}
      <div className="flex flex-wrap gap-6 justify-around pb-6">
        {/* Strengths */}
        <Card className="flex-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Strengths
            </CardTitle>
            <CardDescription>Topics where the student excels</CardDescription>
          </CardHeader>
          <CardContent>
            {selectedStudent.strengths.length > 0 ? (
              <div>
                {selectedStudent.strengths.map((strength, index) => (
                  <div
                    key={strength}
                    className="flex items-center justify-between p-3 mb-4 rounded-lg bg-green-50 border border-green-200"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="default">{index + 1}</Badge>
                      <span className="font-medium">{strength}</span>
                    </div>
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-muted-foreground">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p>
                  No clear strengths identified. Requires fundamental review
                  across all topics.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Weaknesses */}
        <Card className="flex-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Areas for Improvement
            </CardTitle>
            <CardDescription>Topics that need more attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {selectedStudent.weaknesses.map((weakness, index) => (
                <div
                  key={weakness}
                  className="flex items-center justify-between p-3 mb-4 rounded-lg bg-red-50 border border-red-200"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="destructive">{index + 1}</Badge>
                    <span className="font-medium">{weakness}</span>
                  </div>
                  <TrendingDown className="h-4 w-4 text-red-600" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Question-by-Question Analysis with Behavioral Data */}
      <Card className="flex-1">
        <CardHeader>
          <CardTitle>Question-by-Question Analysis</CardTitle>
          <CardDescription>
            Detailed breakdown combining academic performance with behavioral
            insights
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {selectedStudent.questionBehavior.map((question) => (
              <Collapsible key={question.question} className="mb-4">
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-start p-0 h-auto"
                    onClick={() => toggleQuestion(question.question)}
                  >
                    <div className="flex items-center gap-4 p-3 rounded-lg border w-full">
                      <div className="flex items-center gap-2">
                        {expandedQuestions.includes(question.question) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <div className="w-12 text-center font-medium">
                          {question.question}
                        </div>
                      </div>

                      <div className="flex-1 flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          {question.correct ? (
                            <Badge
                              variant="default"
                              className="bg-green-100 text-green-800"
                            >
                              Correct
                            </Badge>
                          ) : (
                            <Badge variant="destructive">Incorrect</Badge>
                          )}

                          {question.flagged && (
                            <Badge
                              variant="outline"
                              className="bg-yellow-50 text-yellow-700 border-yellow-300 "
                            >
                              <Flag className="h-3 w-3 mr-1" />
                              Flagged
                            </Badge>
                          )}

                          {question.attempts > 1 && (
                            <Badge
                              variant="outline"
                              className="bg-blue-50 text-blue-700 border-blue-300"
                            >
                              <RotateCcw className="h-3 w-3 mr-1" />
                              {question.attempts}x
                            </Badge>
                          )}
                        </div>

                        <div
                          className={`text-sm font-medium flex items-center ${getTimeSpentColor(question.timeSpent)}`}
                        >
                          <Clock className="h-3 w-3 inline" />
                          <div className="px-2">{question.timeSpent}min</div>
                        </div>
                      </div>
                    </div>
                  </Button>
                </CollapsibleTrigger>

                <CollapsibleContent className="mt-3">
                  <div className="ml-6 p-4 rounded-lg bg-gray-50 border space-y-4">
                    {/* Behavioral Summary */}
                    <div className="flex gap-4">
                      <div className="flex-1 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <h5 className="font-medium mb-2 flex items-center gap-2 text-blue-800">
                          <Clock className="h-4 w-4" />
                          Time Analysis
                        </h5>
                        <p className="text-sm text-blue-700">
                          Spent {question.timeSpent} minutes
                          {question.timeSpent > 8
                            ? " (excessive time - likely struggling)"
                            : question.timeSpent > 5
                              ? " (above average)"
                              : question.timeSpent < 2
                                ? " (rushed through)"
                                : " (normal pace)"}
                        </p>
                      </div>

                      <div className="flex-1 p-3 bg-purple-50 rounded-lg border border-purple-200">
                        <h5 className="font-medium mb-2 flex items-center gap-2 text-purple-800">
                          <RotateCcw className="h-4 w-4" />
                          Answer Changes
                        </h5>
                        <p className="text-sm text-purple-700">
                          {question.attempts === 1
                            ? "No changes made"
                            : `Changed answer ${question.attempts - 1} time(s)`}
                          {question.originalAnswer &&
                            question.originalAnswer !== question.finalAnswer &&
                            ` (${question.originalAnswer} → ${question.finalAnswer})`}
                        </p>
                      </div>

                      <div className="flex-1 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                        <h5 className="font-medium mb-2 flex items-center gap-2 text-yellow-800">
                          <Flag className="h-4 w-4" />
                          Student Confidence
                        </h5>
                        <p className="text-sm text-yellow-700">
                          {question.flagged
                            ? "Flagged for review (low confidence)"
                            : "Not flagged (confident in answer)"}
                        </p>
                      </div>
                    </div>

                    {/* Mistake Analysis (for incorrect answers) */}
                    {!question.correct && question.error && (
                      <div className="p-4 rounded-lg border bg-card">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <Badge variant="outline">{question.question}</Badge>
                            <Badge
                              variant={
                                question.impact === "High"
                                  ? "destructive"
                                  : "secondary"
                              }
                            >
                              {question.impact} Impact
                            </Badge>
                          </div>
                          <Badge variant="outline">
                            Final Answer: {question.finalAnswer}
                          </Badge>
                        </div>

                        <p className="text-sm text-muted-foreground mb-4">
                          {question.error}
                        </p>

                        {/* Behavioral Insights */}
                        <div className="bg-orange-50 p-3 rounded-md border border-orange-200 mb-4">
                          <h6 className="font-medium text-orange-800 mb-2">
                            Behavioral Insights:
                          </h6>
                          <ul className="text-sm text-orange-700 space-y-1">
                            {question.timeSpent > 8 && (
                              <li>
                                • Excessive time spent suggests fundamental
                                concept confusion
                              </li>
                            )}
                            {question.attempts > 3 && (
                              <li>
                                • Multiple answer changes indicate uncertainty
                                and poor strategy
                              </li>
                            )}
                            {question.flagged && (
                              <li>
                                • Student recognized difficulty but couldn't
                                resolve the issue
                              </li>
                            )}
                            {question.timeSpent < 2 && (
                              <li>
                                • Very short time suggests guessing or giving up
                              </li>
                            )}
                          </ul>
                        </div>

                        {/* Reccomendation */}
                        <div className="bg-blue-50 p-3 rounded-md border border-blue-200 mb-4">
                          <p className="text-sm">
                            <strong>Recommendation:</strong>{" "}
                            {question.error.includes("fundamental") ||
                            question.error.includes("No understanding")
                              ? "Requires intensive review of basic concepts with one-on-one tutoring."
                              : question.error.includes("Confused") ||
                                  question.error.includes("Mixed up")
                                ? "Practice with conceptual differentiation exercises and visual aids."
                                : question.error.includes("Calculation") ||
                                    question.error.includes("Arithmetic")
                                  ? "Focus on computational practice and step-by-step problem solving."
                                  : question.error.includes("Formula")
                                    ? "Review formula derivations and applications with guided practice."
                                    : "Targeted practice with similar problems and concept reinforcement."}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Positive Performance Note (for correct answers) */}
                    {question.correct && (
                      <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                        <h6 className="font-medium text-green-800 mb-2">
                          Performance Summary:
                        </h6>
                        <p className="text-sm text-green-700">
                          Successfully answered correctly
                          {question.timeSpent < 3 &&
                            " with efficient time management"}
                          {question.attempts === 1 && " on first attempt"}
                          {!question.flagged && " with confidence"}.
                        </p>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
