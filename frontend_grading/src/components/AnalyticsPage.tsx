import React, { memo, useMemo, useState } from "react";
import { Button } from "./ui/button";
import { Menu } from "lucide-react";
import { useGradingController } from "../hooks/useGradingController";
import { Sidebar } from "./Sidebar";
import { ClassAnalytics } from "./ClassAnalytics";
import { StudentAnalytics } from "./StudentAnalytics";

interface GradingPageProps {
  courseId?: string;
  assignmentId?: string;
}

export function AnalyticsPage({
  courseId,
  assignmentId,
}: GradingPageProps = {}) {
  const [chooseClassAnalytics, setChooseClassAnalytics] = useState(true); // To force re-render if needed

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
    setError,
  } = useGradingController({ courseId, assignmentId });

  // Loading state
  if (loading) {
    return (
      <div className="bg-[#fafbff] min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading performance insights...</p>
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
          <p className="text-gray-600">
            No students found for this assignment.
          </p>
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
            <h2 className="text-xl font-medium">
              Performance Insights: Physics1112 Midterm 2025F L2
            </h2>
          </div>{" "}
          <div className="flex items-center gap-4">
            {/* Class Analytics Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={setChooseClassAnalytics.bind(null, true)}
              focused={chooseClassAnalytics}
              className="flex items-center gap-2"
            >
              Class Analytics
            </Button>

            {/* Student Analytics Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={setChooseClassAnalytics.bind(null, false)}
              focused={!chooseClassAnalytics}
              className="flex items-center gap-2"
            >
              Student Analytics
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex">
        {/* Sidebar */}
        <Sidebar collapsed={sidebarCollapsed} />

        {/* Main Content */}

        {/* If Student Analytics is selected */}
        <div className="flex-1 p-6">
          {chooseClassAnalytics ? <ClassAnalytics /> : <StudentAnalytics />}
        </div>
      </div>
    </div>
  );
}
