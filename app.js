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
const verificationRoutes = require('./routes/verificationRoutes');
const adminRoutes = require('./routes/adminRoutes');
const reportRoutes = require('./routes/reportRoutes');

const app = express();

// ─── Security Headers ──────────────────────────────────
app.use(helmet());

// ─── CORS ──────────────────────────────────────────────
const allowedOrigins = [
    process.env.CLIENT_URL || 'http://localhost:7001',
    'http://127.0.0.1:7001',
    'http://127.0.0.1:7002',
    'http://82.29.165.57:7001',
    'http://82.29.165.57:7002',
    'http://inakkam.co',
    'https://inakkam.co',
    'http://dashboard.inakkam.co',
    'https://dashboard.inakkam.co',
];

app.use(cors({
    origin: (origin, callback) => {
        // Allow if no origin (like mobile apps/curl) or if matches allowedOrigins
        // or matches localhost/127.0.0.1 on any port in development
        if (
            !origin || 
            allowedOrigins.includes(origin) ||
            /^http:\/\/localhost(:\d+)?$/.test(origin) ||
            /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)
        ) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Body Parsing ──────────────────────────────────────
app.use(express.json({ limit: '50mb' })); // Increased for Base64 image uploads
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// ─── Sanitization ──────────────────────────────────────
// app.use(mongoSanitize()); // Prevent NoSQL injection (Disabled temporarily due to Express 5 compatibility issue)

// ─── Compression & Logging ─────────────────────────────
app.use(compression());
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

const path = require('path');

// ─── Static Uploads Folder ─────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
app.use('/api/verification', verificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reports', reportRoutes);

// ─── 404 Handler ───────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ─── Global Error Handler ──────────────────────────────
app.use(errorHandler);

module.exports = app;
