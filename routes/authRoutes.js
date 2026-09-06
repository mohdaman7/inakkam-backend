const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { register, login, refreshToken, logout, forgotPassword, resetPassword, sendOtp, verifyOtp } = require('../controllers/authController');
const { authLimiter, registerLimiter, otpLimiter } = require('../middlewares/rateLimiter');
const { protect } = require('../middlewares/auth');

// Optional protect middleware: attaches req.user if token is present and valid, allows guest otherwise
const optionalProtect = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
            const user = await User.findById(decoded.id).select('-passwordHash -refreshToken');
            if (user && !user.isDeleted) {
                req.user = user;
            }
        } catch (e) {
            // Allow request to continue without authenticated user
        }
    }
    next();
};

router.post('/register', registerLimiter, register);
router.post('/login', authLimiter, login);
router.post('/refresh', refreshToken);
router.post('/logout', protect, logout);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/send-otp', optionalProtect, otpLimiter, sendOtp);
router.post('/verify-otp', optionalProtect, verifyOtp);

module.exports = router;
