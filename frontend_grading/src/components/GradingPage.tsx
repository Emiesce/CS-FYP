import React, { memo, useMemo } from "react";
import svgPaths from "../assets/svg-paths";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { ChevronLeft, ChevronRight, Search, Users, FileText, Save, CheckCircle, Menu } from "lucide-react";
import { useGradingController } from "../hooks/useGradingController";
import { Sidebar } from "./Sidebar";

const StudentBadges = memo(({ rubrics }: { rubrics: any[] }) => {
  return (
    <div className="flex items-center gap-2">
      {rubrics.map((rubric) => {
        const percentage = (rubric.score / rubric.maxScore) * 100;
        const color = percentage >= 80 ? 'bg-green-100 text-green-800' :
          percentage >= 60 ? 'bg-yellow-100 text-yellow-800' :
            'bg-red-100 text-red-800';
        return (
          <Badge key={rubric.id} className={color}>
            {rubric.score}/{rubric.maxScore}
          </Badge>
        );
      })}
    </div>
  );
});

const TotalScore = memo(({ rubrics }: { rubrics: any[] }) => {
  const totalScore = useMemo(() => {
    return {
      current: rubrics.reduce((sum, r) => sum + r.score, 0),
      maximum: rubrics.reduce((sum, r) => sum + r.maxScore, 0)
    };
  }, [rubrics]);

  return (
    <div className="text-right">
      <div className="text-sm text-gray-600">Total Score</div>
      <div className="text-lg font-semibold">
        {totalScore.current} / {totalScore.maximum}
      </div>
    </div>
  );
});

const RubricCard = memo(({
  rubric,
  isSelected,
  onSelect,
  onScoreUpdate,
  hasUserEdited
}: {
  rubric: any;
  isSelected: boolean;
  onSelect: () => void;
  onScoreUpdate: (score: number) => void;
  hasUserEdited: boolean;
}) => {
  return (
    <Card
      className={`p-6 cursor-pointer transition-all ${isSelected ? 'ring-2 ring-blue-500' : ''
        }`}
      onClick={onSelect}
    >
      <h4 className="text-xl font-semibold text-[#2c2828] mb-4">
        {rubric.title}
      </h4>

      <p className="text-lg text-black mb-4">
        {rubric.description}
      </p>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">Score:</span>
            <Input
              type="number"
              min="0"
              max={rubric.maxScore}
              value={rubric.score}
              onChange={(e) => onScoreUpdate(parseInt(e.target.value) || 0)}
              className="w-16 text-center"
            />
            <span className="text-sm text-gray-600">/ {rubric.maxScore}</span>
          </div>

          {rubric.highlightedText && (
            <Button
              variant={isSelected ? "default" : "outline"}
              size="sm"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                onSelect();
              }}
            >
              {isSelected ? "Hide" : "Show"} Highlight
            </Button>
          )}
        </div>

        {/* AI Suggested Score - only show after user has edited the score */}
        {hasUserEdited && (
          <div className="flex items-center gap-4 pt-2 border-t border-gray-100">
            <span className="text-sm font-medium text-blue-600">AI suggested score:</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-blue-700">{rubric.aiSuggestedScore}</span>
              <span className="text-sm text-gray-600">/ {rubric.maxScore}</span>
              {rubric.aiSuggestedScore !== rubric.score && (
                <Badge
                  variant="outline"
                  className={`text-xs ${rubric.score > rubric.aiSuggestedScore
                    ? 'border-green-300 text-green-700'
                    : 'border-orange-300 text-orange-700'
                    }`}
                >
                  {rubric.score > rubric.aiSuggestedScore ? '+' : ''}{rubric.score - rubric.aiSuggestedScore}
                </Badge>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
});

interface GradingPageProps {
  courseId?: string;
  assignmentId?: string;
}

export function GradingPage({ courseId, assignmentId }: GradingPageProps = {}) {
  // Use the MVC controller
  const {
    loading,
    error,
    currentStudent,
    currentStudentIndex,
    totalStudents,
    selectedRubric,
    sidebarCollapsed,
    lastSaved,
    isAutoSaving,
    nextStudent,
    prevStudent,
    updateRubricScore,
    saveGrades,
    submitGrades,
    setSelectedRubric,
    setSidebarCollapsed,
    getHighlightedText,
    hasUserEditedScore,
    setError
  } = useGradingController({ courseId, assignmentId });

  // Loading state
  if (loading) {
    return (
      <div className="bg-[#fafbff] min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading grading session...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-[#fafbff] min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">⚠️ Error</div>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={() => setError(null)}>Try Again</Button>
        </div>
      </div>
    );
  }

  // No student data
  if (!currentStudent) {
    return (
      <div className="bg-[#fafbff] min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">No students found for this assignment.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#fafbff] min-h-screen relative">
      {/* Top Bar */}
      <div className="bg-[#cee5ff] p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="flex items-center gap-2"
            >
              <Menu className="size-4" />
            </Button>
            <h2 className="text-xl font-medium">Course: MGMT 2030 Midterm 2025F L2</h2>
          </div>            <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Users className="size-4" />
              <span>Student {currentStudentIndex + 1} of {totalStudents}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={prevStudent}
              disabled={currentStudentIndex === 0}
              className="flex items-center gap-2"
            >
              <ChevronLeft className="size-4" />
              Prev
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={nextStudent}
              disabled={currentStudentIndex === totalStudents - 1}
              className="flex items-center gap-2"
            >
              Next
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <Sidebar collapsed={sidebarCollapsed} />

        {/* Main Content */}
        <div className="flex-1 p-4">
          {/* Student Info Header */}
          <div className="mb-4 p-4 bg-white rounded-lg shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <FileText className="size-5 text-blue-600" />
                  <div>
                    <p className="text-sm text-gray-600">Student ID: {currentStudent.studentNumber}</p>
                  </div>
                </div>
                <StudentBadges rubrics={currentStudent.rubrics} />
              </div>
              <TotalScore rubrics={currentStudent.rubrics} />
            </div>
          </div>

          {/* Student Essay */}
          <Card className="p-6 mb-4">
            <div className="prose prose-lg max-w-none">
              <div
                dangerouslySetInnerHTML={{
                  __html: getHighlightedText(currentStudent.essay, selectedRubric || '')
                }}
              />
            </div>
          </Card>
        </div>

        {/* Right Panel - Rubrics */}
        <div className="w-[535px] p-4 space-y-6 flex flex-col h-[calc(100vh-80px)]">
          <h3 className="text-2xl font-semibold text-[#2c2828] underline">
            Rubrics descriptions
          </h3>

          <div className="flex-1 space-y-6 overflow-y-auto px-1 py-1">
            {currentStudent.rubrics.map((rubric) => (
              <RubricCard
                key={rubric.id}
                rubric={rubric}
                isSelected={selectedRubric === rubric.id}
                onSelect={() => setSelectedRubric(selectedRubric === rubric.id ? null : rubric.id)}
                onScoreUpdate={(score) => updateRubricScore(rubric.id, score)}
                hasUserEdited={hasUserEditedScore(rubric.id)}
              />
            ))}
          </div>

          {/* Bottom section with last saved and submit */}
          <div className="mt-auto pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Last saved: {lastSaved.toLocaleTimeString()}
              </div>
              <Button
                className="bg-[#3edf04] text-[#52af30] border border-[#3edf04] hover:bg-[#2fc503]"
                onClick={submitGrades}
              >
                Submit
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}