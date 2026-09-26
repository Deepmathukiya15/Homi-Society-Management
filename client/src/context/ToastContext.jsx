import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
};

const AUTO_DISMISS = { INFO: 6500, SUCCESS: 6000, WARNING: 8000, ALERT: 13000 };

/**
 * Auth failures (expired / invalid / missing JWT) are reported exactly once, by
 * the session handler in AuthContext, which signs the user out and explains why.
 * Feature-level catch blocks stay silent for those, so a dead session no longer
 * stacks "Not authorized — no token provided" alerts on top of one another.
 */
const AUTH_FAILURE = /not authorized|no token provided|invalid or expired session token|token (?:failed|expired)|jwt (?:expired|malformed)/i;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const seq = useRef(0);

  const removeToast = useCallback((id) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);

  const pushToast = useCallback(
    (title, message, type = 'INFO') => {
      if (AUTH_FAILURE.test(String(message || ''))) return null;
      seq.current += 1;
      const id = `toast-${seq.current}-${Date.now()}`;
      const timestamp = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      setToasts((prev) => [{ id, title, message, type, timestamp }, ...prev].slice(0, 6));
      setTimeout(() => removeToast(id), AUTO_DISMISS[type] ?? 6000);
      return id;
    },
    [removeToast]
  );

  const value = useMemo(
    () => ({
      toasts,
      removeToast,
      pushToast,
      info: (title, message) => pushToast(title, message, 'INFO'),
      success: (title, message) => pushToast(title, message, 'SUCCESS'),
      warning: (title, message) => pushToast(title, message, 'WARNING'),
      alert: (title, message) => pushToast(title, message, 'ALERT'),
    }),
    [toasts, removeToast, pushToast]
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}
