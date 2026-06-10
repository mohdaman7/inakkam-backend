require('dotenv').config();
const crypto = require('crypto');
global.crypto = crypto; // Make crypto globally available for MongoDB
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const connectDB = require('./config/db');
const chatSocket = require('./sockets/chatSocket');

const PORT = process.env.PORT || 5000;

// ─── Create HTTP + Socket.io server ───────────────────
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:5173',
        methods: ['GET', 'POST'],
        credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
});

// ─── Attach Socket handlers ────────────────────────────
chatSocket(io);

// ─── Start server after DB connects ───────────────────
const startServer = async () => {
    await connectDB();
    server.listen(PORT, () => {
        console.log(`\n🚀 Inakkam API running at http://localhost:${PORT}`);
        console.log(`🔌 Socket.io listening on ws://localhost:${PORT}`);
        console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}\n`);
    });
};

startServer();

// ─── Graceful Shutdown ─────────────────────────────────
process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err.message);
    server.close(() => process.exit(1));
});

process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    server.close(() => process.exit(0));
});
