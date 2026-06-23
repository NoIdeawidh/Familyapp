import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { ToastProvider } from './components/ui/Toast';
import { AppShell } from './components/layout/AppShell';
import { LandingPage } from './pages/LandingPage';
import { CreateFamilyPage } from './pages/auth/CreateFamilyPage';
import { JoinFamilyPage } from './pages/auth/JoinFamilyPage';
import { LoginPage } from './pages/auth/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { TasksPage } from './pages/TasksPage';
import { MapPage } from './pages/MapPage';
import { RewardsPage } from './pages/RewardsPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { AdminPage } from './pages/admin/AdminPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { member, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Lädt...</p>
      </div>
    );
  }

  if (!member) {
    return <Navigate to="/" replace />;
  }

  return <AppShell>{children}</AppShell>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { member, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (member) {
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<PublicRoute><LandingPage /></PublicRoute>} />
      <Route path="/auth/create-family" element={<PublicRoute><CreateFamilyPage /></PublicRoute>} />
      <Route path="/auth/join-family" element={<PublicRoute><JoinFamilyPage /></PublicRoute>} />
      <Route path="/auth/login" element={<PublicRoute><LoginPage /></PublicRoute>} />

      {/* Protected routes */}
      <Route path="/app" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/app/tasks" element={<ProtectedRoute><TasksPage /></ProtectedRoute>} />
      <Route path="/app/map" element={<ProtectedRoute><MapPage /></ProtectedRoute>} />
      <Route path="/app/rewards" element={<ProtectedRoute><RewardsPage /></ProtectedRoute>} />
      <Route path="/app/leaderboard" element={<ProtectedRoute><LeaderboardPage /></ProtectedRoute>} />
      <Route path="/app/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
