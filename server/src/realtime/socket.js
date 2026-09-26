import { Server } from 'socket.io';
import { verifyToken } from '../utils/tokens.js';
import { db } from '../store/index.js';

let io = null;

/**
 * Socket.io event bus.
 * Rooms:
 *   flat_<FLAT_ID> → isolated per-flat channel (resident devices)
 *   guard_feed     → gate terminal tablets
 *   admin_feed     → management command center
 */
export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    path: '/socket.io',
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(); // allow anonymous listeners (read-only) for public telemetry
    try {
      socket.user = verifyToken(token);
    } catch {
      socket.user = null;
    }
    next();
  });

  io.on('connection', (socket) => {
    const user = socket.user;
    const role = user?.role || 'ANONYMOUS';
    if (role === 'GUARD') socket.join('guard_feed');
    if (role === 'ADMIN') socket.join('admin_feed');
    if (role !== 'ANONYMOUS') socket.join('all_users');
    if (user?.flatId) socket.join(`flat_${user.flatId}`);

    socket.emit('socket_ready', {
      message: 'Socket.io Connected: Live Gate Telemetry Active',
      role,
      rooms: [...socket.rooms],
      connectedAt: new Date().toISOString(),
    });

    socket.on('join_flat', ({ flatId }) => {
      if (!flatId) return;
      socket.join(`flat_${String(flatId).toUpperCase()}`);
      socket.emit('joined_room', { room: `flat_${String(flatId).toUpperCase()}` });
    });

    socket.on('join_role_room', ({ role: r }) => {
      if (r === 'GUARD') socket.join('guard_feed');
      if (r === 'ADMIN') socket.join('admin_feed');
    });

    // Resident approves / denies straight over the websocket (REST fallback also exists).
    // The decision is persisted — not just relayed — then broadcast to every feed so
    // guard / admin / flat screens all flip status together.
    socket.on('visitor_decision', async ({ visitorId, status, guardNote }) => {
      if (!visitorId || !['APPROVED', 'DENIED'].includes(status)) return;
      if (!user || (user.role || 'ANONYMOUS') !== 'RESIDENT') return;
      try {
        const visitor = await db.Visitor.findById(String(visitorId));
        if (!visitor) return;
        // Residents may only action visitors for their own flat
        if (visitor.flatId !== user.flatId) return;
        if (visitor.approvalStatus !== 'PENDING') return;

        // The JWT payload carries id/role/flatId — resolve the display name from the account.
        const account = await db.User.findById(String(user.id));
        const decidedBy = account?.name || user.name || 'Resident';

        const updated = await db.Visitor.findByIdAndUpdate(
          visitor._id,
          { $set: { approvalStatus: status, approvedBy: decidedBy, guardNote: guardNote || '' } },
          { new: true }
        );

        const payload = { visitor: updated, decidedBy, at: new Date().toISOString() };
        emitToGuards('visitor_updated', payload);
        emitToAdmins('visitor_updated', payload);
        emitToFlat(updated.flatId, 'visitor_updated', payload);
        emitToRoom('guard_feed', 'resident_decision_relay', { visitorId, status, by: decidedBy });
        emitToRoom('admin_feed', 'resident_decision_relay', { visitorId, status, by: decidedBy });
        socket.emit('visitor_decision_result', { visitor: updated, status });
      } catch (err) {
        console.error('[SOCKET] visitor_decision failed:', err.message);
      }
    });

    socket.on('disconnect', () => {
      /* telemetry only */
    });
  });

  console.log('[SOCKET] Socket.io event bus online (rooms: flat_*, guard_feed, admin_feed)');
  return io;
}

export const getIO = () => io;
export const emitToRoom = (room, event, payload) => io?.to(room).emit(event, payload);
export const emitToFlat = (flatId, event, payload) => io?.to(`flat_${flatId}`).emit(event, payload);
export const emitToGuards = (event, payload) => io?.to('guard_feed').emit(event, payload);
export const emitToAdmins = (event, payload) => io?.to('admin_feed').emit(event, payload);
export const broadcast = (event, payload) => io?.emit(event, payload);
