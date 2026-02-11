import React, { memo, useMemo, useState } from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import * as CardComponent from "./ui/card";
import {
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Search,
  Users,
  FileText,
  Save,
  CheckCircle,
  Brain,
  Target,
  AlertCircle,
  Menu,
} from "lucide-react";
import { useGradingController } from "../hooks/useGradingController";
import { Sidebar } from "./Sidebar";
import { Progress } from "./ui/progress";
import { questionAnalysisData } from "./rubric/QuestionAnalysisDummy";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "./ui/collapsible";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const { Card, CardHeader, CardTitle, CardDescription, CardContent } =
  CardComponent;

const scoreDistributionData = [
  { range: "0-2", count: 1 },
  { range: "2-4", count: 2 },
  { range: "4-6", count: 3 },
  { range: "6-8", count: 3 },
  { range: "8-10", count: 7 },
  { range: "10-12", count: 12 },
  { range: "12-14", count: 4 },
  { range: "14-16", count: 16 },
  { range: "16-18", count: 6 },
  { range: "18-20", count: 2 },
];

const completionTimeData = [
  { time: "0-15min", count: 3 },
  { time: "15-30min", count: 8 },
  { time: "30-45min", count: 15 },
  { time: "45-60min", count: 12 },
  { time: "60min+", count: 6 },
];

interface StatisticCardProps {
  title: string;
  value: string | number;
  description?: string;
}

const StatisticCard = memo(function StatisticCard({
  title,
  value,
  description,
}: StatisticCardProps) {
  return (
    <Card className="flex flex-col justify-between flex-1 pb-4">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-black/70">
          {title}
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="text-3xl font-semibold">{value}</div>

        {description && (
          <CardDescription className="mt-1 text-sm">
            {description}
          </CardDescription>
        )}
      </CardContent>
    </Card>
  );
});

interface PerformanceCardProps {
  title: string;
  items: { label: string; value?: string | number }[];
  variant?: string;
}

const variantStyles = {
  danger: "bg-red-100",
  success: "bg-green-100",
  info: "bg-blue-200",
  warning: "bg-yellow-100",
};

const PerformanceCard = memo(function PerformanceCard({
  title,
  items,
  variant,
}: PerformanceCardProps) {
  return (
    <Card className={`flex flex-1 ${variant ? variant : variantStyles.info}`}>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
      </CardHeader>

      <CardContent>
        <ul className="text-sm">
          {items.map((item, index) => (
            <li key={index}>
              • {item.label}
              {item.value && (
                <span className="text-gray-600 ml-2">{item.value}</span>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
});

const performanceValues = [
  {
    title: "Weakest Topics",
    items: [
      { label: "Strong understanding of kinematics" },
      { label: "Accurate problem-solving skills" },
      { label: "Good application of formulas" },
    ],
    variant: variantStyles["danger"],
  },
  {
    title: "Strongest Topics",
    items: [
      { label: "Excellent grasp of Newton's Laws" },
      { label: "Proficient in energy conservation concepts" },
      { label: "Skilled in momentum and collisions" },
    ],
    variant: variantStyles["success"],
  },
  {
    title: "Common Misconceptions",
    items: [
      { label: "Frequent errors in free-body diagrams" },
      { label: "Misapplication of kinematic equations" },
      { label: "Confusion between mass and weight" },
    ],
    variant: variantStyles["warning"],
  },
  {
    title: "Recommendations for Improvement",
    items: [
      { label: "Review Newton's Laws and practice related problems" },
      { label: "Focus on energy conservation principles" },
      { label: "Practice drawing and analyzing free-body diagrams" },
    ],
    variant: variantStyles["info"],
  },
];

const statisticValues = [
  {
    title: "Average Score",
    value: "14.5/20",
    description: "Class performance",
  },
  {
    title: "Median Score",
    value: "15/20",
    description: "Middle performer",
  },
  {
    title: "Std. Deviation",
    value: "3.2",
    description: "Score spread",
  },
  {
    title: "Bottom 25%",
    value: "8.7/20",
    description: "Needs improvement",
  },
  {
    title: "Top 25%",
    value: "18.2/20",
    description: "Excellent performance",
  },
  {
    title: "Avg Time",
    value: "42 min",
    description: "Average time spent",
  },
];

export function ClassAnalytics() {
  const [expandedQuestions, setExpandedQuestions] = useState<string[]>([]);

  const toggleQuestion = (questionId: string) => {
    setExpandedQuestions((prev) =>
      prev.includes(questionId)
        ? prev.filter((id) => id !== questionId)
        : [...prev, questionId],
    );
  };

  const hardestQuestions = questionAnalysisData
    .sort((a, b) => a.correct - b.correct)
    .slice(0, 3);

  const easiestQuestions = questionAnalysisData
    .sort((a, b) => b.correct - a.correct)
    .slice(0, 3);

  return (
    <div className="flex-1 p-8">
      {/* Class Statistics */}
      <div className="flex flex-wrap gap-6 justify-around p-6">
        {/* Value props would be changed to real analytics data */}
        {statisticValues.map((stat) => (
          <StatisticCard
            key={stat.title}
            title={stat.title}
            value={stat.value}
            description={stat.description}
          />
        ))}
      </div>

      {/* AI Performance Summary */}
      <div className="w-full mt-8 px-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium text-black/70">
              AI Performance Summary
            </CardTitle>
            <CardTitle className="text-md text-gray-600">
              AI-generated insights about overall exam performance
            </CardTitle>
          </CardHeader>

          <CardContent className="flex flex-wrap gap-6 justify-around p-6">
            {/* Performance Cards Grid */}
            {performanceValues.map((perf) => (
              <PerformanceCard
                key={perf.title}
                title={perf.title}
                items={perf.items}
                variant={perf.variant}
              />
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Score Distribution & Completion Time Distribution */}
      <div className="flex flex-wrap gap-6 justify-around p-6">
        <Card className="flex-1">
          <CardHeader>
            <CardTitle className="text-lg text-black/70 font-medium">
              Score Distribution
            </CardTitle>
            <CardTitle className="text-md text-gray-600">
              Distribution of student scores across the exam
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={scoreDistributionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="flex-1">
          <CardHeader>
            <CardTitle className="text-lg text-black/70 font-medium">
              Completion Time Distribution
            </CardTitle>
            <CardTitle className="text-md text-gray-600">
              How long students took to complete the exam
            </CardTitle>
          </CardHeader>

          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={completionTimeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.time}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                ></Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Questions ReCap */}
      <div className="flex flex-wrap gap-6 justify-around p-6">
        {/* Hardest Questions */}
        <Card className="flex-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {/* <TrendingDown className="h-5 w-5 text-red-500" /> */}
              Hardest Questions
            </CardTitle>
            <CardDescription>
              Questions with the lowest success rates
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {hardestQuestions.map((question, index) => (
              <div
                key={question.question}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <Badge variant="destructive">{index + 1}</Badge>
                  <div>
                    <p className="font-medium">{question.question}</p>
                    <p className="text-sm text-muted-foreground">
                      {question.topic}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium">{question.correct}%</p>
                  <Badge variant="outline" className="text-xs">
                    {question.difficulty}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Easiest Questions */}
        <Card className="flex-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {/* <TrendingUp className="h-5 w-5 text-green-500" /> */}
              Easiest Questions
            </CardTitle>
            <CardDescription>
              Questions with the highest success rates
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {easiestQuestions.map((question, index) => (
              <div
                key={question.question}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <Badge variant="default">{index + 1}</Badge>
                  <div>
                    <p className="font-medium">{question.question}</p>
                    <p className="text-sm text-muted-foreground">
                      {question.topic}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium">{question.correct}%</p>
                  <Badge variant="outline" className="text-xs">
                    {question.difficulty}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Detailed Question Analysis - Expandable */}
      <div className="w-full mt-8 px-6">
        <Card>
          <CardHeader>
            <CardTitle>Complete Question Analysis</CardTitle>
            <CardDescription>
              Click on any question to view detailed analysis including
              discrimination index and common mistakes
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div>
              {questionAnalysisData.map((question) => (
                <Collapsible key={question.question} className="py-2">
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-start p-0 h-auto"
                      onClick={() => toggleQuestion(question.question)}
                    >
                      <div className="flex items-center gap-4 p-3 rounded-lg border w-full">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium flex items-center gap-2">
                              {expandedQuestions.includes(question.question) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                              {question.topic}
                            </span>
                            <span className="text-sm font-medium">
                              {question.correct}%
                            </span>
                          </div>

                          <Progress value={question.correct} className="h-2" />
                        </div>
                        <Badge
                          variant={
                            question.difficulty === "Easy"
                              ? "default"
                              : question.difficulty === "Medium"
                                ? "secondary"
                                : "destructive"
                          }
                        >
                          {question.difficulty}
                        </Badge>
                      </div>
                    </Button>
                  </CollapsibleTrigger>

                  <CollapsibleContent className="mt-3">
                    <div className="ml-6 p-4 rounded-lg border space-y-4">
                      {/* Summary + AI Insights */}
                      <div className="p-3 bg-secondary rounded-lg border border-blue-200">
                        <p className="text-sm font-medium text-blue-800">
                          Summary
                        </p>
                        <p className="text-sm text-blue-700">
                          {question.summary}
                        </p>
                        <p className="text-sm">{question.aiInsights}</p>
                      </div>

                      {/* Common Wrong Answers */}
                      <div className="p-3 bg-red-100 rounded-lg border">
                        <h5 className="font-medium py-2 flex items-center">
                          <AlertCircle className="h-4 w-4 px-2" />
                          Common Wrong Answers
                        </h5>

                        <div className="space-y-2">
                          {question.commonWrongAnswers.map((answer, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between p-4 bg-white rounded border"
                            >
                              <div className="flex items-center gap-3">
                                <Badge
                                  variant="outline"
                                  className="w-8 h-6 justify-center"
                                >
                                  {answer.option}
                                </Badge>
                                <span className="text-sm">{answer.reason}</span>
                              </div>

                              <Badge variant="secondary" className="text-xs">
                                {answer.percentage}%
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
