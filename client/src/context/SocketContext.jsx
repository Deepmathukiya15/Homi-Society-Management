import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { tokenStore, visitorApi } from '../lib/api.js';
import { useAuth } from './AuthContext.jsx';
import { useToast } from './ToastContext.jsx';
import { playApproved, playDenied, playChime, playSiren } from '../lib/sound.js';

const SocketContext = createContext(null);

export const useSocket = () => {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used inside <SocketProvider>');
  return ctx;
};

const STATUS_LABEL = {
  CONNECTING: 'Connecting to Socket.io…',
  CONNECTED: 'Socket.io Connected: Live Gate Telemetry Active',
  RECONNECTING: 'WS Reconnecting…',
  OFFLINE: 'Socket.io Offline',
};

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const toast = useToast();
  const [status, setStatus] = useState('CONNECTING');
  const [incomingVisitor, setIncomingVisitor] = useState(null);
  const socketRef = useRef(null);
  const listenersRef = useRef(new Map());

  /** The toast context identity changes whenever a toast is pushed/removed —
   *  using a ref here keeps the socket lifecycle effect from tearing down and
   *  re-creating the whole Socket.io connection on every toast. */
  const toastRef = useRef(toast);
  toastRef.current = toast;

  /** Lightweight pub/sub so any page can react to live events */
  const on = useCallback((event, handler) => {
    const map = listenersRef.current;
    if (!map.has(event)) map.set(event, new Set());
    map.get(event).add(handler);
    return () => map.get(event)?.delete(handler);
  }, []);

  const emitLocal = useCallback((event, payload) => {
    listenersRef.current.get(event)?.forEach((fn) => {
      try {
        fn(payload);
      } catch (err) {
        console.error('socket handler error', err);
      }
    });
  }, []);

  useEffect(() => {
    const token = tokenStore.get();
    if (!user || !token) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setStatus('OFFLINE');
      return undefined;
    }

    const socket = io(window.location.origin, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionDelay: 1200,
    });
    socketRef.current = socket;
    setStatus('CONNECTING');

    socket.on('connect', () => socket.emit('join_role_room', { role: user.role }));
    socket.on('socket_ready', async () => {
      setStatus('CONNECTED');
      emitLocal('socket_ready');

      // Catch-up: surface any approval request that was dispatched to this flat
      // while the resident device was offline / signed out.
      if (user.role === 'RESIDENT') {
        try {
          const res = await visitorApi.logs({ status: 'PENDING' });
          const pending = (res.visitors || []).find((v) => v.flatId === user.flatId);
          if (pending) {
            setIncomingVisitor((current) => current || { visitor: pending, at: pending.checkInTime });
          }
        } catch {
          /* catch-up is best-effort */
        }
      }
    });
    socket.io.on('reconnect_attempt', () => setStatus('RECONNECTING'));
    socket.on('disconnect', () => setStatus('RECONNECTING'));

    // ── Live visitor sanction request → resident approval popup ───────────
    socket.on('new_visitor_request', (payload) => {
      setIncomingVisitor(payload);
      playChime();
      toastRef.current.warning('Visitor at Main Gate', `${payload.visitor.guestName} (${payload.visitor.purpose}) awaits entry approval for Flat ${payload.visitor.flatId}.`);
      emitLocal('new_visitor_request', payload);
    });

    socket.on('visitor_updated', (payload) => {
      emitLocal('visitor_updated', payload);
      if (user.role === 'GUARD') {
        if (payload.visitor.approvalStatus === 'APPROVED') {
          playApproved();
          toastRef.current.success('Entry Approved', `${payload.visitor.guestName} admitted to Flat ${payload.visitor.flatId}.`);
        } else if (payload.visitor.approvalStatus === 'DENIED') {
          playDenied();
          toastRef.current.alert('Entry Denied', `Security guard notified — ${payload.visitor.guestName} refused entry.`);
        } else {
          playApproved();
          toastRef.current.success('QR Pass Accepted', `Welcome ${payload.visitor.guestName} to Flat ${payload.visitor.flatId}.`);
        }
      } else if (user.role === 'ADMIN') {
        toastRef.current.info('Gate Telemetry', `${payload.visitor.guestName} → Flat ${payload.visitor.flatId} (${payload.visitor.approvalStatus})`);
      }
    });

    socket.on('visitor_checked_out', (payload) => {
      emitLocal('visitor_checked_out', payload);
      toastRef.current.info('Visitor Checked Out', `${payload.visitor.guestName} logged out of society gate.`);
    });

    socket.on('bill_generated', (payload) => {
      emitLocal('bill_generated', payload);
      toastRef.current.info('Maintenance Invoice Generated', `${payload.bill.billingPeriod} • ₹${Number(payload.bill.amount).toLocaleString('en-IN')} payable by the 10th.`);
    });

    socket.on('bill_paid', (payload) => {
      emitLocal('bill_paid', payload);
      if (user.role === 'ADMIN') {
        toastRef.current.success('Payment Received', `₹${Number(payload.bill.amount).toLocaleString('en-IN')} credited for Flat ${payload.bill.flatId} (${payload.bill.paymentMode}).`);
      }
    });

    socket.on('notice_published', (payload) => {
      emitLocal('notice_published', payload);
      if (user.role !== 'ADMIN') toastRef.current.info('Notice Published', payload.notice.title);
    });

    socket.on('complaint_updated', (payload) => {
      emitLocal('complaint_updated', payload);
      if (user.role === 'RESIDENT') toastRef.current.success('Complaint Updated', `${payload.complaint.ticketNo} • status is now ${payload.complaint.status}`);
    });

    socket.on('sos_broadcast', (payload) => {
      emitLocal('sos_broadcast', payload);
      playSiren();
      toastRef.current.alert(`SOS • ${payload.category}`, `Flat ${payload.flatId} (${payload.raisedBy}). ${payload.note || 'Immediate response required.'}`);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user, emitLocal]);

  const respondToIncoming = useCallback(
    async (status, guardNote) => {
      if (!incomingVisitor?.visitor) return;
      try {
        const res = await visitorApi.decide(incomingVisitor.visitor._id, status, guardNote);
        if (status === 'APPROVED') {
          playApproved();
          toast.success('Entry Approved', res.message);
        } else {
          playDenied();
          toast.alert('Entry Denied', res.message);
        }
        setIncomingVisitor(null);
        emitLocal('visitor_decision_local', res.visitor);
      } catch (err) {
        toast.alert('Action Failed', err.message);
      }
    },
    [incomingVisitor, toast, emitLocal]
  );

  const value = useMemo(
    () => ({
      socket: socketRef.current,
      status,
      statusLabel: STATUS_LABEL[status] || STATUS_LABEL.CONNECTING,
      connected: status === 'CONNECTED',
      incomingVisitor,
      clearIncoming: () => setIncomingVisitor(null),
      approveIncoming: (note) => respondToIncoming('APPROVED', note),
      denyIncoming: (note) => respondToIncoming('DENIED', note),
      on,
    }),
    [status, incomingVisitor, respondToIncoming, on]
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}
