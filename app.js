require('dotenv').config();
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const cookieParser = require('cookie-parser');

const { globalLimiter } = require('./middlewares/rateLimiter');
const errorHandler = require('./middlewares/errorHandler');

// Route imports
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const discoverRoutes = require('./routes/discoverRoutes');
const swipeRoutes = require('./routes/swipeRoutes');
const matchRoutes = require('./routes/matchRoutes');
const conversationRoutes = require('./routes/conversationRoutes');
const storyRoutes = require('./routes/storyRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const membershipRoutes = require('./routes/membershipRoutes');

const app = express();

// ─── Security Headers ──────────────────────────────────
app.use(helmet());

// ─── CORS ──────────────────────────────────────────────
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Body Parsing ──────────────────────────────────────
app.use(express.json({ limit: '10kb' })); // Prevent large payload attacks
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// ─── Sanitization ──────────────────────────────────────
// app.use(mongoSanitize()); // Prevent NoSQL injection (Disabled temporarily due to Express 5 compatibility issue)

// ─── Compression & Logging ─────────────────────────────
app.use(compression());
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// ─── Global Rate Limit ─────────────────────────────────
app.use('/api', globalLimiter);

// ─── Health Check ──────────────────────────────────────
app.get('/health', (req, res) => res.json({ success: true, status: 'Inakkam API is running 🔥', timestamp: new Date().toISOString() }));

// ─── API Routes ────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/discover', discoverRoutes);
app.use('/api/swipe', swipeRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/stories', storyRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/membership', membershipRoutes);

// ─── 404 Handler ───────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ─── Global Error Handler ──────────────────────────────
app.use(errorHandler);

module.exports = app;
