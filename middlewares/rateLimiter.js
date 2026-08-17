const rateLimit = require('express-rate-limit');
const isDev = process.env.NODE_ENV === 'development';

const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: isDev ? 1000 : 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests, please try again later.' },
    validate: { trustProxy: false },
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isDev ? 100 : 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many login attempts, please try again in 15 minutes.' },
    validate: { trustProxy: false },
});

const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: isDev ? 100 : 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many accounts created from this IP, please try later.' },
    validate: { trustProxy: false },
});

const swipeLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: isDev ? 1000 : 500, // free users limited at controller level
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Swipe limit reached, upgrade to Premium for unlimited swipes.' },
    validate: { trustProxy: false },
});

const otpLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: isDev ? 30 : 5, // 5 requests per 5 minutes in prod, 30 in dev
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many OTP requests. Please try again after 5 minutes.' },
    validate: { trustProxy: false },
});

module.exports = { globalLimiter, authLimiter, registerLimiter, swipeLimiter, otpLimiter };
