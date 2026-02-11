import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { GradingPage } from "./components/GradingPage";
import { RubricUploadPage } from "./components/RubricUploadPage";
import { ToastProvider } from "./components/ui/toast";
import { AnalyticsPage } from "./components/AnalyticsPage";

export default function App() {
  return (
    <ToastProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Navigate to="/grading" replace />} />
          <Route
            path="/dashboard"
            element={<div className="p-8">Dashboard - Coming Soon</div>}
          />
          <Route path="/grading" element={<GradingPage />} />
          <Route path="/rubric-upload" element={<RubricUploadPage />} />
          {/* Placeholder routes for other navigation items */}
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route
            path="/proctoring"
            element={<div className="p-8">Proctoring Page - Coming Soon</div>}
          />
        </Routes>
      </Router>
    </ToastProvider>
  );
}
