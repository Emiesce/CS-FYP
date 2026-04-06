import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { RubricUploadPage } from "./components/RubricUploadPage";
import { StudentAnswersPage } from "./pages/StudentAnswersPage";
import { GradingResultsPage } from "./pages/GradingResultsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ToastProvider } from "./components/ui/toast";

export default function App() {
  return (
    <ToastProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/grading" element={<GradingResultsPage />} />
          <Route path="/rubric-upload" element={<RubricUploadPage />} />
          <Route path="/student-answers" element={<StudentAnswersPage />} />
          <Route path="/analytics" element={<div className="p-8">Analytics Page - Coming Soon</div>} />
          <Route path="/proctoring" element={<div className="p-8">Proctoring Page - Coming Soon</div>} />
        </Routes>
      </Router>
    </ToastProvider>
  );
}