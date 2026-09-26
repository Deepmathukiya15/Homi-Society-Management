import { Navigate, useLocation } from 'react-router-dom';
import BootSplash from '../components/BootSplash.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export const homeFor = (role) => (role === 'ADMIN' ? '/admin' : role === 'GUARD' ? '/guard' : '/resident');

export default function ProtectedRoute({ role, children }) {
  const { user, booting } = useAuth();
  const location = useLocation();

  if (booting) return <BootSplash />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (role && user.role !== role) return <Navigate to={homeFor(user.role)} replace />;
  return children;
}
