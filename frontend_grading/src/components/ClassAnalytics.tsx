import React, { memo, useMemo, useState, useEffect } from "react";
import Markdown from "react-markdown";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import * as CardComponent from "./ui/card";
import {
  Sparkle,
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
import { Progress } from "./ui/progress";
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
import { AIChatbot } from "./ui/ClassAnalytics_Chat";

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
  value: number;
  description?: string;
}

interface questionAnalysisData {
  examId: string;
  questionId: string;
  topicId: string;
  aggregateScore: number;
  successRate: number;
  scoreDistribution: number[];
  feedbacks: string[];
  misconceptions: { clusterId: number; summary: string; count: number }[];
}

interface topicAnalysisData {
  topicId: string;
  totalScore: number;
  totalMaxScore: number;
  averagePercentage: number;
  rank: number;
  misconceptions: { questionId: number; summary: string; count: number }[];
  summary: string;
}

interface examSummaryData {
  commonMisconceptions: string;
  recommendations: string;
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
        <div className="text-3xl font-semibold">{value * 100}</div>

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

export function ClassAnalytics() {
  const [expandedQuestions, setExpandedQuestions] = useState<string[]>([]);
  const [expandedTopics, setExpandedTopics] = useState<string[]>([]);
  const [stats, setStats] = useState<StatisticCardProps[]>([]);
  const [askAI, setAskAI] = useState(false);

  const [questionAnalysis, setQuestionAnalysis] = useState<
    questionAnalysisData[]
  >([]);
  const [topicsAnalysis, setTopicsAnalysis] = useState<topicAnalysisData[]>([]);
  const [examSummary, setExamSummary] = useState<examSummaryData>({
    commonMisconceptions: "",
    recommendations: "",
  });

  async function fetchStatistics(examId: string) {
    const response = await fetch(
      `http://127.0.0.1:8000/api/exam/${examId}/statistics`,
    );

    const data = await response.json();
    return data;
  }

  async function fetchQuestionsAnalysis(examId: string) {
    const response = await fetch(
      `http://127.0.0.1:8000/api/exam/${examId}/questionsAnalysis`,
    );

    const data = await response.json();
    return data;
  }

  async function fetchTopicsAnalysis(examId: string) {
    const response = await fetch(
      `http://127.0.0.1:8000/api/exam/${examId}/topics`,
    );

    const data = await response.json();
    return data;
  }

  async function fetchExamSummary(examId: string) {
    const response = await fetch(
      `http://127.0.0.1:8000/api/exam/${examId}/summary`,
    );

    const data = await response.json();
    return data;
  }

  useEffect(() => {
    async function loadData() {
      const [s, q, t, e] = await Promise.all([
        fetchStatistics("EXAM1"),
        fetchQuestionsAnalysis("EXAM1"),
        fetchTopicsAnalysis("EXAM1"),
        fetchExamSummary("EXAM1"),
      ]);

      console.log("statistics:", s);
      console.log("question statistics:", q);
      console.log("topics analysis:", t);
      console.log("exam summary:", e);

      setStats(s.cards);
      setQuestionAnalysis(q);
      setTopicsAnalysis(t);
      setExamSummary(e);
    }

    loadData();
  }, []);

  const toggleQuestion = (questionId: string) => {
    setExpandedQuestions((prev) =>
      prev.includes(questionId)
        ? prev.filter((id) => id !== questionId)
        : [...prev, questionId],
    );
  };

  const toggleTopic = (topicId: string) => {
    setExpandedTopics((prev) =>
      prev.includes(topicId)
        ? prev.filter((id) => id !== topicId)
        : [...prev, topicId],
    );
  };

  const hardestQuestions = [...questionAnalysis]
    .sort((a, b) => a.successRate - b.successRate)
    .slice(0, 3);

  const easiestQuestions = [...questionAnalysis]
    .sort((a, b) => b.successRate - a.successRate)
    .slice(0, 3);

  const weakestTopics = [...topicsAnalysis]
    .sort((a, b) => a.averagePercentage - b.averagePercentage)
    .slice(0, 3);

  const strongestTopics = [...topicsAnalysis]
    .sort((a, b) => b.averagePercentage - a.averagePercentage)
    .slice(0, 3);

  return (
    <div className="flex h-[calc(100vh-12rem)]">
      <div className="flex-1 p-8">
        {/* Class Statistics */}
        <div className="flex flex-wrap gap-6 justify-around p-6">
          {/* Value props would be changed to real analytics data */}
          {stats.map((stat) => (
            <StatisticCard
              key={stat.title}
              title={stat.title}
              value={stat.value}
              description={stat.description}
            />
          ))}
        </div>

        {/* Exam Summary */}
        <div className="flex flex-wrap gap-6 justify-around p-6">
          <Card className="flex-1 bg-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Exam Summary
              </CardTitle>
              <CardDescription>Overview of exam performance</CardDescription>
            </CardHeader>

            <CardContent className="bg-blue-50">
              <div className="flex flex-wrap gap-6 justify-around mb-8">
                {/* Common Misconceptions */}
                <div className="flex-1 border rounded-lg p-4 bg-white">
                  <CardTitle className="text-base text-black/70 font-medium">
                    Common Misconceptions
                  </CardTitle>
                  <p className="text-sm text-muted-foreground py-2 text-justify">
                    <Markdown>{examSummary.commonMisconceptions}</Markdown>
                  </p>
                </div>

                {/* Recommendations */}
                <div className="flex-1 border rounded-lg p-4 bg-white">
                  <CardTitle className="text-base text-black/70 font-medium">
                    Recommendations
                  </CardTitle>
                  <p className="text-sm text-muted-foreground py-2 text-justify">
                    <Markdown>{examSummary.recommendations}</Markdown>
                  </p>
                </div>
              </div>

              <Button
                size="sm"
                onClick={() => setAskAI(askAI ? false : true)}
                className="bg-card text-black/70 flex items-center gap-2"
              >
                <Sparkle className="w-4 h-4" />
                Ask AI for more details
              </Button>
              {/* {askAI && (
                <p className="text-sm text-muted-foreground mt-2">
                  AI is analyzing the data and will provide insights shortly...
                </p>
              )} */}
            </CardContent>
          </Card>
        </div>

        {/* Topic Analysis */}
        <div className="flex flex-wrap gap-6 justify-around p-6">
          {/* Strongest Topics */}
          <Card className="flex-1 bg-green-100">
            <CardHeader>
              <CardTitle className="text-lg text-black/70 font-medium">
                Strongest Topics
              </CardTitle>
              <CardTitle className="text-md text-gray-600">
                Topics where students performed best
              </CardTitle>
            </CardHeader>

            <CardContent>
              {strongestTopics.map((topic) => (
                <Collapsible key={topic.topicId} className="py-2">
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-start p-0 h-auto"
                      onClick={() => toggleTopic(topic.topicId)}
                    >
                      <div className="flex items-center gap-4 p-3 rounded-lg border w-full">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium flex items-center gap-2">
                              {expandedTopics.includes(topic.topicId) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                              {topic.topicId}
                            </span>
                          </div>
                        </div>
                        <Badge
                          variant={
                            topic.averagePercentage >= 80
                              ? "default"
                              : topic.averagePercentage >= 50
                                ? "secondary"
                                : "destructive"
                          }
                        >
                          {topic.averagePercentage}%
                        </Badge>
                      </div>
                    </Button>
                  </CollapsibleTrigger>

                  <CollapsibleContent className="mt-3">
                    <div className="ml-6 p-4 rounded-lg border space-y-4">
                      {/* Summary */}
                      <div className="p-3 rounded-lg border">
                        <h5 className="font-medium py-2 flex items-center">
                          <AlertCircle className="h-4 w-4 mr-2" />
                          Summary
                        </h5>
                        {topic.summary ? (
                          <p className="text-sm text-muted-foreground text-justify">
                            {topic.summary}
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            No summary available
                          </p>
                        )}
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </CardContent>
          </Card>

          {/* Weakest Topics */}
          <Card className="flex-1 bg-red-100">
            <CardHeader>
              <CardTitle className="text-lg text-black/70 font-medium">
                Weakest Topics
              </CardTitle>
              <CardTitle className="text-md text-gray-600">
                Topics where students performed worst
              </CardTitle>
            </CardHeader>

            <CardContent>
              {weakestTopics.map((topic) => (
                <Collapsible key={topic.topicId} className="py-2">
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-start p-0 h-auto"
                      onClick={() => toggleTopic(topic.topicId)}
                    >
                      <div className="flex items-center gap-4 p-3 rounded-lg border w-full">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium flex items-center gap-2">
                              {expandedTopics.includes(topic.topicId) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                              {topic.topicId}
                            </span>
                          </div>
                        </div>
                        <Badge
                          variant={
                            topic.averagePercentage >= 80
                              ? "default"
                              : topic.averagePercentage >= 50
                                ? "secondary"
                                : "destructive"
                          }
                        >
                          {topic.averagePercentage}%
                        </Badge>
                      </div>
                    </Button>
                  </CollapsibleTrigger>

                  <CollapsibleContent className="mt-3">
                    <div className="ml-6 p-4 rounded-lg border space-y-4">
                      {/* Summary */}
                      <div className="p-3 rounded-lg border">
                        <h5 className="font-medium py-2 flex items-center">
                          <AlertCircle className="h-4 w-4 mr-2" />
                          Summary
                        </h5>
                        {topic.summary ? (
                          <p className="text-sm text-muted-foreground text-justify">
                            {topic.summary}
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            No summary available
                          </p>
                        )}
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Score Distribution & Completion Time Distribution */}
        {/*<div className="flex flex-wrap gap-6 justify-around p-6">
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
      */}

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
                  key={question.questionId}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="destructive">{index + 1}</Badge>
                    <div>
                      <p className="font-medium">{question.questionId}</p>
                      <p className="text-sm text-muted-foreground">
                        {question.topicId}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{question.successRate}%</p>
                    <Badge variant="outline" className="text-xs">
                      {question.successRate >= 80
                        ? "Easy"
                        : question.successRate >= 50
                          ? "Medium"
                          : "Hard"}
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
                  key={question.questionId}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="default">{index + 1}</Badge>
                    <div>
                      <p className="font-medium">{question.questionId}</p>
                      <p className="text-sm text-muted-foreground">
                        {question.topicId}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{question.successRate}%</p>
                    <Badge variant="outline" className="text-xs">
                      {question.successRate >= 80
                        ? "Easy"
                        : question.successRate >= 50
                          ? "Medium"
                          : "Hard"}
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
                Click on any question to view detailed analysis
              </CardDescription>
            </CardHeader>

            <CardContent>
              <div>
                {questionAnalysis.map((question) => (
                  <Collapsible key={question.questionId} className="py-2">
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        className="w-full justify-start p-0 h-auto"
                        onClick={() => toggleQuestion(question.questionId)}
                      >
                        <div className="flex items-center gap-4 p-3 rounded-lg border w-full">
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium flex items-center gap-2">
                                {expandedQuestions.includes(
                                  question.questionId,
                                ) ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                                {question.questionId} - {question.topicId}
                              </span>
                            </div>

                            <Progress
                              value={question.successRate}
                              className="h-2"
                            />
                          </div>
                          <Badge
                            variant={
                              question.successRate >= 80
                                ? "default"
                                : question.successRate >= 50
                                  ? "secondary"
                                  : "destructive"
                            }
                          >
                            {question.successRate}%
                          </Badge>
                        </div>
                      </Button>
                    </CollapsibleTrigger>

                    <CollapsibleContent className="mt-3">
                      <div className="ml-6 p-4 rounded-lg border space-y-4">
                        {/* Common Wrong Answers */}
                        <div className="p-3 bg-red-100 rounded-lg border">
                          <h5 className="font-medium py-2 flex items-center">
                            <AlertCircle className="h-4 w-4 mr-2" />
                            Common Wrong Answers
                          </h5>

                          <div className="space-y-2">
                            {question.misconceptions.map(
                              (misconception, index) => (
                                <div
                                  key={index}
                                  className="flex items-center justify-between p-4 bg-white rounded border"
                                >
                                  <span className="text-sm">
                                    {misconception.summary}
                                  </span>
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {misconception.count} students
                                  </Badge>
                                </div>
                              ),
                            )}
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

      {askAI && (
        <div className="w-[420px] min-w-[360px] sticky top-6">
          <AIChatbot onClose={() => setAskAI(false)} examId="EXAM1" />
        </div>
      )}
    </div>
  );
}
