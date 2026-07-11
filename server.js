const path = require('path');
const dns = require('dns');

dns.setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const crypto = require('crypto');
global.crypto = crypto; // Make crypto globally available for MongoDB
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const connectDB = require('./config/db');
const chatSocket = require('./sockets/chatSocket');

const DEFAULT_PORT = 7000;
const basePort = Number(process.env.PORT) || DEFAULT_PORT;
let currentPort = basePort;
let attemptedFallback = false;

// ─── Create HTTP + Socket.io server ───────────────────
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:7001',
        methods: ['GET', 'POST'],
        credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
});

// ─── Attach Socket handlers ────────────────────────────
chatSocket(io);

// ─── Server error listener ─────────────────────────────
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        if (!attemptedFallback) {
            attemptedFallback = true;
            const fallbackPort = currentPort + 1;
            console.warn(`⚠️ Port ${currentPort} is already in use. Trying port ${fallbackPort} instead...`);
            currentPort = fallbackPort;
            server.listen(currentPort);
            return;
        }
        console.error(`❌ Port ${currentPort} is already in use. Stop the other process or set a different PORT.`);
    } else {
        console.error('❌ Server error:', err);
    }
    process.exit(1);
});

// ─── Start server after DB connects ───────────────────
const startServer = async () => {
    try {
        await connectDB();
        server.listen(currentPort, () => {
            console.log(`\n🚀 Inakkam API running at http://localhost:${currentPort}`);
            console.log(`🔌 Socket.io listening on ws://localhost:${currentPort}`);
            console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}\n`);
        });
    } catch (err) {
        console.error('Startup failed:', err);
        process.exit(1);
    }
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
