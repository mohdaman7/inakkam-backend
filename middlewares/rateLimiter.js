const rateLimit = require('express-rate-limit');

const isDev = process.env.NODE_ENV === 'development';

/**
 * Global API rate limiter
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
    validate: false
});

/**
 * Authentication / Login rate limiter
 */
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isDev ? 1000 : 100,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        const identifier = req.body?.email || req.body?.phone || req.ip;
        return `auth_${identifier}`;
    },
    message: {
        success: false,
        message: 'Too many login attempts, please try again later.'
    },
    validate: false
});

/**
 * Registration rate limiter
 */
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: isDev ? 500 : 50,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many accounts created, please try again later.'
    },
    validate: false
});

/**
 * Swipe rate limiter
 */
const swipeLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: isDev ? 10000 : 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Swipe limit reached, upgrade to Premium for unlimited swipes.'
    },
    validate: false
});

/**
 * OTP rate limiter
 *
 * Keys by target phone number to prevent IP sharing/proxy false-positives
 * while allowing generous retry attempts (30 requests / 5 minutes).
 */
const otpLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: isDev ? 100 : 30,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        const phone = req.body?.phone;
        if (phone && typeof phone === 'string') {
            const cleanPhone = phone.replace(/\D/g, '');
            if (cleanPhone.length >= 7) {
                return `otp_phone_${cleanPhone}`;
            }
        }
        return `otp_ip_${req.ip || 'unknown'}`;
    },
    message: {
        success: false,
        message: 'Too many OTP requests for this number. Please wait a moment before trying again.'
    },
    validate: false
});

module.exports = {
    globalLimiter,
    authLimiter,
    registerLimiter,
    swipeLimiter,
    otpLimiter
};