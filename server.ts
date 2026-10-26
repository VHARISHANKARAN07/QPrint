import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import next from 'next';
import express from 'express';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);
const socketPort = parseInt(process.env.SOCKET_PORT || '3001', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // Main Next.js server
  const expressApp = express();
  expressApp.use((req: any, res: any) => handle(req, res));

  const nextServer = createServer(expressApp);
  nextServer.listen(port, () => {
    console.log(`🖨️  Qprint server ready on http://${hostname}:${port}`);
  });

  // Socket.IO server (separate port for real-time)
  const socketApp = express();
  socketApp.use(express.json());

  const socketServer = createServer(socketApp);
  const io = new SocketIOServer(socketServer, {
    cors: {
      origin: `http://${hostname}:${port}`,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Socket.IO connection handling
  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Join user-specific room for targeted notifications
    socket.on('join:user', (userId: string) => {
      socket.join(`user:${userId}`);
      console.log(`📋 User ${userId} joined their room`);
    });

    // Join role-specific room
    socket.on('join:role', (role: string) => {
      socket.join(`role:${role}`);
      console.log(`📋 Role room joined: ${role}`);
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });

  // Internal API for Next.js API routes to emit events
  socketApp.post('/internal/emit', (req: any, res: any) => {
    const { event, data } = req.body;

    if (!event) {
      return res.status(400).json({ error: 'Event name required' });
    }

    // Broadcast to all connected clients
    io.emit(event, data);

    // If data contains userId, also emit to user-specific room
    if (data?.userId) {
      io.to(`user:${data.userId}`).emit(event, data);
    }

    // If data contains userRole, also emit to role-specific room
    if (data?.userRole) {
      io.to(`role:${data.userRole}`).emit(event, data);
    }

    // Always notify shop handler
    io.to('role:SHOP_HANDLER').emit(event, data);

    res.json({ ok: true });
  });

  socketServer.listen(socketPort, () => {
    console.log(`⚡ Socket.IO server ready on http://${hostname}:${socketPort}`);
  });
});
