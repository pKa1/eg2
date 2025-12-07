import { Routes, Route, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from './store/authStore'
import { authService } from './services/authService'

// Pages
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import TeacherTestsPage from './pages/teacher/TestsPage'
import TeacherCreateTestPage from './pages/teacher/CreateTestPage'
import TeacherTestDetailPage from './pages/teacher/TestDetailPage'
import TeacherGroupsPage from './pages/teacher/GroupsPage'
import TeacherGroupDetailPage from './pages/teacher/GroupDetailPage'
import TeacherGroupAnalyticsPage from './pages/teacher/GroupAnalyticsPage'
import TeacherStudentsPage from './pages/teacher/StudentsPage'
import TeacherStudentDetailPage from './pages/teacher/StudentDetailPage'
import TeacherTestAssignPage from './pages/teacher/TestAssignPage'
import TeacherTestResultsPage from './pages/teacher/TestResultsPage'
import TeacherResultDetailPage from './pages/teacher/ResultDetailPage'
import StudentTestsPage from './pages/student/TestsPage'
import StudentTakeTestPage from './pages/student/TakeTestPage'
import StudentResultsPage from './pages/student/ResultsPage'
import ParentDashboardPage from './pages/parent/DashboardPage'
import AdminUsersPage from './pages/admin/UsersPage'
import SettingsPage from './pages/admin/SettingsPage'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import { UserRole } from './types'
import ErrorBoundary from './components/ErrorBoundary'

function App() {
  const { setUser, isAuthenticated } = useAuthStore()

  // Fetch current user on mount if token exists
  useQuery({
    queryKey: ['currentUser'],
    queryFn: authService.getCurrentUser,
    enabled: !!localStorage.getItem('access_token') && !isAuthenticated,
    onSuccess: (data) => {
      setUser(data)
    },
    onError: () => {
      setUser(null)
    },
  })

  return (
    <ErrorBoundary>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      
      <Route element={<Layout />}>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        {/* Teacher Routes */}
        <Route
          path="/teacher/tests"
          element={
            <ProtectedRoute allowedRoles={[UserRole.TEACHER, UserRole.ADMIN]}>
              <TeacherTestsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher/groups"
          element={
            <ProtectedRoute allowedRoles={[UserRole.TEACHER, UserRole.ADMIN]}>
              <TeacherGroupsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher/groups/:id"
          element={
            <ProtectedRoute allowedRoles={[UserRole.TEACHER, UserRole.ADMIN]}>
              <TeacherGroupDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher/groups/:id/analytics"
          element={
            <ProtectedRoute allowedRoles={[UserRole.TEACHER, UserRole.ADMIN]}>
              <TeacherGroupAnalyticsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher/students"
          element={
            <ProtectedRoute allowedRoles={[UserRole.TEACHER, UserRole.ADMIN]}>
              <TeacherStudentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher/students/:id"
          element={
            <ProtectedRoute allowedRoles={[UserRole.TEACHER, UserRole.ADMIN]}>
              <TeacherStudentDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher/tests/create"
          element={
            <ProtectedRoute allowedRoles={[UserRole.TEACHER, UserRole.ADMIN]}>
              <TeacherCreateTestPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher/tests/:id"
          element={
            <ProtectedRoute allowedRoles={[UserRole.TEACHER, UserRole.ADMIN]}>
              <TeacherTestDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher/tests/:id/assign"
          element={
            <ProtectedRoute allowedRoles={[UserRole.TEACHER, UserRole.ADMIN]}>
              <TeacherTestAssignPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher/tests/:id/results"
          element={
            <ProtectedRoute allowedRoles={[UserRole.TEACHER, UserRole.ADMIN]}>
              <TeacherTestResultsPage />
            </ProtectedRoute>
          }
        />

        {/* Student Routes */}
        <Route
          path="/student/tests"
          element={
            <ProtectedRoute allowedRoles={[UserRole.STUDENT]}>
              <StudentTestsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/tests/:id/take"
          element={
            <ProtectedRoute allowedRoles={[UserRole.STUDENT]}>
              <StudentTakeTestPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/results"
          element={
            <ProtectedRoute allowedRoles={[UserRole.STUDENT]}>
              <StudentResultsPage />
            </ProtectedRoute>
          }
        />

        {/* Parent Routes */}
        <Route
          path="/parent/dashboard"
          element={
            <ProtectedRoute allowedRoles={[UserRole.PARENT]}>
              <ParentDashboardPage />
            </ProtectedRoute>
          }
        />

        {/* Admin Routes */}
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
              <AdminUsersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher/results/:id"
          element={
            <ProtectedRoute allowedRoles={[UserRole.TEACHER, UserRole.ADMIN]}>
              <TeacherResultDetailPage />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </ErrorBoundary>
  )
}

export default App

