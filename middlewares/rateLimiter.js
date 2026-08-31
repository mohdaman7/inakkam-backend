const rateLimit = require('express-rate-limit');

const isDev = process.env.NODE_ENV === 'development';

/**
 * Global API rate limiter
 *
 * Development:
 *   10,000 requests / 15 minutes
 *
 * Production:
 *   500 requests / 15 minutes
 */
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isDev ? 10000 : 5000,

    standardHeaders: true,
    legacyHeaders: false,

    message: {
        success: false,
        message: 'Too many requests, please try again later.'
    },

    validate: {
        trustProxy: false
    }
});


/**
 * Authentication / Login rate limiter
 *
 * Development:
 *   1,000 requests / 15 minutes
 *
 * Production:
 *   30 requests / 15 minutes
 *
 * NOTE:
 * Do not remove the limiter completely in production.
 */
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isDev ? 1000 : 30,

    standardHeaders: true,
    legacyHeaders: false,

    message: {
        success: false,
        message: 'Too many login attempts, please try again later.'
    },

    validate: {
        trustProxy: false
    }
});


/**
 * Registration rate limiter
 *
 * Development:
 *   500 registrations / hour
 *
 * Production:
 *   10 registrations / hour
 */
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: isDev ? 500 : 10,

    standardHeaders: true,
    legacyHeaders: false,

    message: {
        success: false,
        message: 'Too many accounts created from this IP, please try again later.'
    },

    validate: {
        trustProxy: false
    }
});


/**
 * Swipe rate limiter
 *
 * Development:
 *   10,000 swipes / hour
 *
 * Production:
 *   500 swipes / hour
 *
 * Free-user limits should still be handled
 * separately at the controller/business-logic level.
 */
const swipeLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: isDev ? 10000 : 500,

    standardHeaders: true,
    legacyHeaders: false,

    message: {
        success: false,
        message: 'Swipe limit reached, upgrade to Premium for unlimited swipes.'
    },

    validate: {
        trustProxy: false
    }
});


/**
 * OTP rate limiter
 *
 * Development:
 *   100 requests / 5 minutes
 *
 * Production:
 *   5 requests / 5 minutes
 */
const otpLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: isDev ? 100 : 5,

    standardHeaders: true,
    legacyHeaders: false,

    message: {
        success: false,
        message: 'Too many OTP requests. Please try again after 5 minutes.'
    },

    validate: {
        trustProxy: false
    }
});


module.exports = {
    globalLimiter,
    authLimiter,
    registerLimiter,
    swipeLimiter,
    otpLimiter
};