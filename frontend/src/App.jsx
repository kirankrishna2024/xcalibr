import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

// Public pages
import LandingPage from "./pages/LandingPage";
import CandidateLogin from "./pages/CandidateLogin";
import CandidateSignup from "./pages/CandidateSignup";
import RecruiterLogin from "./pages/RecruiterLogin";
import CareersPage from "./pages/CareersPage";
import AboutPage from "./pages/Aboutpage";
import PricingPage from "./pages/PricingPage";
import ContactPage from "./pages/Contactpage";
import CandidateForgotPassword from "./pages/CandidateForgotPassword";
import RecruiterForgotPassword from "./pages/RecruiterForgotPassword";

// Candidate layout pages
import DashboardLayout from "./layouts/DashboardLayout";
import ProfilePage from "./pages/ProfilePage";
import JobBoard from "./pages/JobBoard";
import MyApplications from "./pages/MyApplications";
import CandidateFeedbackPage from "./pages/CandidateFeedbackPage";
import SettingsPage from "./pages/Settingspage";

// Recruiter layout pages
import RecruiterDashboard from "./pages/RecruiterDashboard";
import ApplicantsPage from "./pages/ApplicantsPage";
import ManageJobsPage from "./pages/ManageJobsPage"; // ← WEEK 7: replaces PostJobPage
import HRFeedbackPage from "./pages/HRFeedbackPage";

// Admin layout pages
import AdminLayout from "./layouts/AdminLayout";
import AdminLogin from "./pages/AdminLogin";
import AdminProtectedRoute from "./components/AdminProtectedRoute";
import AdminDashboard from "./pages/AdminDashboard";
import AdminUserManagement from "./pages/AdminUserManagement";
import SystemLogPage from "./pages/SystemLogPage";

function App() {
  return (
    <Router>
      <Routes>
        {/* ---------- Public Routes ---------- */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/candidate/login" element={<CandidateLogin />} />
        <Route path="/candidate/signup" element={<CandidateSignup />} />
        <Route path="/recruiter/login" element={<RecruiterLogin />} />
        <Route path="/careers" element={<CareersPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/contact" element={<ContactPage />} />

        {/* ---------- Forgot Password Routes ---------- */}
        <Route path="/candidate/forgot-password" element={<CandidateForgotPassword />} />
        <Route path="/recruiter/forgot-password" element={<RecruiterForgotPassword />} />

        {/* ---------- Admin Section ---------- */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route element={<AdminProtectedRoute />}>
          <Route path="/system-admin-portal-2024" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="user-management" element={<AdminUserManagement />} />
            <Route path="system-logs" element={<SystemLogPage />} />
          </Route>
        </Route>

        {/* ---------- Candidate Dashboard ---------- */}
        <Route element={<DashboardLayout role="candidate" />}>
          <Route path="/candidate/profile" element={<ProfilePage />} />
          <Route path="/candidate/job-board" element={<JobBoard />} />
          <Route path="/candidate/applications" element={<MyApplications />} />
          <Route path="/candidate/feedback" element={<CandidateFeedbackPage />} />
          <Route path="/candidate/settings" element={<SettingsPage />} />
        </Route>

        {/* ---------- Recruiter Dashboard ---------- */}
        <Route element={<DashboardLayout role="recruiter" />}>
          <Route path="/recruiter/dashboard" element={<RecruiterDashboard />} />
          <Route path="/recruiter/applicants" element={<ApplicantsPage />} />
          <Route path="/recruiter/feedback" element={<HRFeedbackPage />} />
          {/* WEEK 7: /recruiter/manage-jobs replaces /recruiter/post-job */}
          <Route path="/recruiter/manage-jobs" element={<ManageJobsPage />} />
          {/* Keep old route for backward compat — redirects to manage-jobs */}
          <Route path="/recruiter/post-job" element={<ManageJobsPage />} />
          <Route path="/recruiter/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
