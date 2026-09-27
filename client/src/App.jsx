import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { SocketProvider } from './context/SocketContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import BootSplash from './components/BootSplash.jsx';
import TopHeader from './components/TopHeader.jsx';
import ToastStack from './components/ToastStack.jsx';
import IncomingVisitorModal from './components/IncomingVisitorModal.jsx';
import Login from './pages/Login.jsx';
import AdminPortal from './pages/admin/AdminPortal.jsx';
import ResidentPortal from './pages/resident/ResidentPortal.jsx';
import GuardPortal from './pages/guard/GuardPortal.jsx';
import CommitteePortal from './pages/committee/CommitteePortal.jsx';
import CleanerPortal from './pages/cleaner/CleanerPortal.jsx';
import ProtectedRoute, { homeFor } from './routes/ProtectedRoute.jsx';

function Shell() {
  const { user, booting } = useAuth();

  if (booting) return <BootSplash />;

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {user && <TopHeader />}
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to={homeFor(user.role)} replace /> : <Login />}
        />
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute role="ADMIN">
              <AdminPortal />
            </ProtectedRoute>
          }
        />
        <Route
          path="/resident/*"
          element={
            <ProtectedRoute role="RESIDENT">
              <ResidentPortal />
            </ProtectedRoute>
          }
        />
        <Route
          path="/guard/*"
          element={
            <ProtectedRoute role="GUARD">
              <GuardPortal />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cleaner/*"
          element={
            <ProtectedRoute role="CLEANER">
              <CleanerPortal />
            </ProtectedRoute>
          }
        />
        <Route
          path="/committee/*"
          element={
            user && (user.role === 'ADMIN' || user.isCommitteeMember)
              ? <CommitteePortal />
              : <Navigate to={user ? homeFor(user.role) : '/login'} replace />
          }
        />
        <Route path="*" element={<Navigate to={user ? homeFor(user.role) : '/login'} replace />} />
      </Routes>
      <IncomingVisitorModal />
      <ToastStack />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <SocketProvider>
          <Shell />
        </SocketProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
