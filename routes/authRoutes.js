const express = require('express');
const router = express.Router();
const { register, login, refreshToken, logout, forgotPassword, resetPassword } = require('../controllers/authController');
const { authLimiter, registerLimiter } = require('../middlewares/rateLimiter');
const { protect } = require('../middlewares/auth');

router.post('/register', registerLimiter, register);
router.post('/login', authLimiter, login);
router.post('/refresh', refreshToken);
router.post('/logout', protect, logout);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;
