import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi, setUnauthorizedHandler, tokenStore } from '../lib/api.js';
import { useToast } from './ToastContext.jsx';

const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};

export function AuthProvider({ children }) {
  const toast = useToast();
  const [user, setUser] = useState(null);
  const [flat, setFlat] = useState(null);
  const [booting, setBooting] = useState(true);
  const [loading, setLoading] = useState(false);

  const applySession = useCallback((data) => {
    if (data?.token) tokenStore.set(data.token);
    setUser(data?.user || null);
    return data?.user || null;
  }, []);

  const logout = useCallback(
    (silent = false) => {
      tokenStore.clear();
      setUser(null);
      setFlat(null);
      if (!silent) toast.info('Signed Out', 'Your HOMI session has been closed securely.');
    },
    [toast]
  );

  /**
   * Any protected API call returning 401 means the session is no longer valid
   * (expired token, server data reset, revoked user). Sign the user out cleanly
   * so ProtectedRoute sends them to the login screen instead of showing a portal
   * where every request fails.
   */
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser((current) => {
        if (current) {
          toast.warning('Session Expired', 'Please sign in again — your previous session is no longer valid.');
        }
        return null;
      });
      setFlat(null);
    });
  }, [toast]);

  // Restore an existing JWT session on boot
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!tokenStore.get()) {
        setBooting(false);
        return;
      }
      try {
        const data = await authApi.me();
        if (!alive) return;
        setUser(data.user);
        setFlat(data.flat);
      } catch {
        tokenStore.clear();
        setUser(null);
        setFlat(null);
      } finally {
        if (alive) setBooting(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const login = useCallback(
    async (email, password) => {
      setLoading(true);
      try {
        const data = await authApi.login({ email, password });
        applySession(data);
        toast.success('Welcome back', `${data.user.name} • ${data.user.role} portal unlocked`);
        return data.user;
      } finally {
        setLoading(false);
      }
    },
    [applySession, toast]
  );

  /**
   * Registration no longer signs the applicant in: residents and guards are
   * created with approvalStatus = PENDING and must be approved by the society
   * admin before they can authenticate. Returns { pending, user, message }.
   */
  const register = useCallback(
    async (payload) => {
      setLoading(true);
      try {
        const data = await authApi.register(payload);
        if (data.pendingApproval) {
          toast.info('Approval Pending', 'Your account is with the society admin for approval. You can sign in once it is approved.');
          return { pending: true, user: data.user, message: data.message };
        }
        applySession(data);
        toast.success('Registration Successful', `Welcome to HOMI, ${data.user.name}!`);
        return { pending: false, user: data.user };
      } finally {
        setLoading(false);
      }
    },
    [applySession, toast]
  );

  const demoLogin = useCallback(
    async (role) => {
      setLoading(true);
      try {
        const data = await authApi.demoLogin(role);
        applySession(data);
        toast.info('1-Click Demo Login', `Signed in as ${data.user.name} • ${role} portal`);
        return data.user;
      } finally {
        setLoading(false);
      }
    },
    [applySession, toast]
  );

  const value = useMemo(
    () => ({
      user,
      flat,
      setFlat,
      booting,
      loading,
      login,
      register,
      demoLogin,
      logout,
      isAuthenticated: Boolean(user),
      role: user?.role || null,
    }),
    [user, flat, booting, loading, login, register, demoLogin, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
