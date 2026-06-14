import { Routes, Route, Navigate } from 'react-router-dom';

import Layout from './components/layout/Layout';
import PrivateRoute from './routes/PrivateRoute';
import RoleRoute from './routes/RoleRoute';

import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import AttendPage from './pages/AttendPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import TraineesPage from './pages/trainees/TraineesPage';
import AttendancePage from './pages/attendance/AttendancePage';
import SessionDetailPage from './pages/attendance/SessionDetailPage';
import SubmissionsPage from './pages/submissions/SubmissionsPage';
import NewSubmissionPage from './pages/submissions/NewSubmissionPage';
import DowntimePage from './pages/downtime/DowntimePage';
import InstructorsPage from './pages/users/InstructorsPage';
import UsersPage from './pages/admin/UsersPage';
import SiteContentPage from './pages/admin/SiteContentPage';
import DepartmentsPage from './pages/admin/DepartmentsPage';
import AuditLogPage from './pages/admin/AuditLogPage';
import PlatformSettingsPage from './pages/admin/PlatformSettingsPage';
import MaintenancePage from './pages/MaintenancePage';
import ProfilePage from './pages/account/ProfilePage';
import SettingsPage from './pages/account/SettingsPage';
import TasksPage from './pages/tasks/TasksPage';
import InquiriesPage from './pages/inquiries/InquiriesPage';
import RemindersPage from './pages/attachee/RemindersPage';
import AttacheesPage from './pages/attachees/AttacheesPage';
import AttacheeDetailPage from './pages/attachees/AttacheeDetailPage';
import SupervisorAttendancePage from './pages/attendance/SupervisorAttendancePage';
import AnnouncementsPage from './pages/announcements/AnnouncementsPage';
import SessionLogsPage from './pages/sessionLogs/SessionLogsPage';
import PerformancePage from './pages/performance/PerformancePage';
import CertificatesPage from './pages/certificates/CertificatesPage';
import ProgramsPage from './pages/programs/ProgramsPage';
import AttacheeProfilePage from './pages/AttacheeProfilePage';
import AIReportsPage from './pages/AIReportsPage';
import AssistantPage from './pages/ai/AssistantPage';
import AIUsagePage from './pages/admin/AIUsagePage';
import VerifyPage from './pages/verify/VerifyPage';
import DocumentsPage from './pages/documents/DocumentsPage';
import AdminDocumentsPage from './pages/admin/AdminDocumentsPage';
import TermsPage from './pages/legal/TermsPage';
import PrivacyPage from './pages/legal/PrivacyPage';

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/attend/:token" element={<AttendPage />} />

      {/* Legal (public) */}
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/maintenance" element={<MaintenancePage />} />
      {/* Public document verification — no login required */}
      <Route path="/verify/:document_id" element={<VerifyPage />} />
      {/* Common aliases → canonical paths */}
      <Route path="/terms-of-service" element={<Navigate to="/terms" replace />} />
      <Route path="/privacy-policy" element={<Navigate to="/privacy" replace />} />

      {/* Authenticated (wrapped in Layout) */}
      <Route
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />

        {/* Announcements — all authenticated roles */}
        <Route path="/announcements" element={<AnnouncementsPage />} />

        {/* Supervisor department-wide attendance overview */}
        <Route
          path="/dept-attendance"
          element={
            <RoleRoute roles={['supervisor']}>
              <SupervisorAttendancePage />
            </RoleRoute>
          }
        />

        <Route
          path="/session-logs"
          element={
            <RoleRoute roles={['instructor', 'supervisor']}>
              <SessionLogsPage />
            </RoleRoute>
          }
        />
        <Route
          path="/performance"
          element={
            <RoleRoute roles={['supervisor']}>
              <PerformancePage />
            </RoleRoute>
          }
        />
        <Route
          path="/certificates"
          element={
            <RoleRoute roles={['supervisor', 'admin']}>
              <CertificatesPage />
            </RoleRoute>
          }
        />
        <Route
          path="/programs"
          element={
            <RoleRoute roles={['supervisor', 'instructor']}>
              <ProgramsPage />
            </RoleRoute>
          }
        />

        {/* AI Attachee Intelligence Layer */}
        <Route
          path="/ai/attachees/:attacheeId/profile"
          element={
            <RoleRoute roles={['instructor', 'supervisor']}>
              <AttacheeProfilePage />
            </RoleRoute>
          }
        />
        <Route
          path="/ai/reports/new"
          element={
            <RoleRoute roles={['supervisor']}>
              <AIReportsPage />
            </RoleRoute>
          }
        />
        <Route
          path="/ai/assistant"
          element={
            <RoleRoute roles={['supervisor']}>
              <AssistantPage />
            </RoleRoute>
          }
        />

        <Route
          path="/trainees"
          element={
            <RoleRoute roles={['instructor']} requireFlag="has_trainees">
              <TraineesPage />
            </RoleRoute>
          }
        />
        <Route
          path="/attendance"
          element={
            <RoleRoute roles={['instructor']} requireFlag="has_trainees">
              <AttendancePage />
            </RoleRoute>
          }
        />
        <Route
          path="/attendance/:sessionId"
          element={
            <RoleRoute roles={['instructor', 'supervisor']}>
              <SessionDetailPage />
            </RoleRoute>
          }
        />

        <Route path="/submissions" element={<SubmissionsPage />} />
        <Route
          path="/submissions/new"
          element={
            <RoleRoute roles={['instructor', 'attachee']}>
              <NewSubmissionPage />
            </RoleRoute>
          }
        />

        {/* Attachment / internship programme */}
        <Route
          path="/tasks"
          element={
            <RoleRoute roles={['attachee', 'instructor', 'supervisor']}>
              <TasksPage />
            </RoleRoute>
          }
        />
        <Route
          path="/inquiries"
          element={
            <RoleRoute roles={['attachee', 'instructor', 'supervisor']}>
              <InquiriesPage />
            </RoleRoute>
          }
        />
        <Route
          path="/reminders"
          element={
            <RoleRoute roles={['attachee']}>
              <RemindersPage />
            </RoleRoute>
          }
        />
        <Route
          path="/attachees"
          element={
            <RoleRoute roles={['instructor', 'supervisor']}>
              <AttacheesPage />
            </RoleRoute>
          }
        />
        <Route
          path="/attachees/:id"
          element={
            <RoleRoute roles={['instructor', 'supervisor']}>
              <AttacheeDetailPage />
            </RoleRoute>
          }
        />

        <Route path="/downtime" element={<DowntimePage />} />

        <Route
          path="/instructors"
          element={
            <RoleRoute roles={['supervisor']}>
              <InstructorsPage />
            </RoleRoute>
          }
        />

        {/* System admin */}
        <Route
          path="/users"
          element={
            <RoleRoute roles={['admin']}>
              <UsersPage />
            </RoleRoute>
          }
        />
        <Route
          path="/site"
          element={
            <RoleRoute roles={['admin']}>
              <SiteContentPage />
            </RoleRoute>
          }
        />
        <Route
          path="/departments"
          element={
            <RoleRoute roles={['admin']}>
              <DepartmentsPage />
            </RoleRoute>
          }
        />
        <Route
          path="/audit"
          element={
            <RoleRoute roles={['admin']}>
              <AuditLogPage />
            </RoleRoute>
          }
        />
        <Route
          path="/platform-settings"
          element={
            <RoleRoute roles={['admin']}>
              <PlatformSettingsPage />
            </RoleRoute>
          }
        />
        <Route
          path="/admin/ai-usage"
          element={
            <RoleRoute roles={['admin']}>
              <AIUsagePage />
            </RoleRoute>
          }
        />
        <Route
          path="/admin/documents"
          element={
            <RoleRoute roles={['admin']}>
              <AdminDocumentsPage />
            </RoleRoute>
          }
        />
        <Route
          path="/documents"
          element={
            <RoleRoute roles={['supervisor']}>
              <DocumentsPage />
            </RoleRoute>
          }
        />

        {/* Account (all authenticated users) */}
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
