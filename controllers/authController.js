const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { sendEmail } = require('../utils/sendEmail');

// Simple in-memory store for OTPs during development
const otpStore = new Map();

const signAccess = (id) =>
    jwt.sign({ id }, process.env.JWT_ACCESS_SECRET, { expiresIn: process.env.JWT_ACCESS_EXPIRES });

const signRefresh = (id) =>
    jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRES });

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res, next) => {
    try {
        const { name, email, phone, password, age } = req.body;

        if (!email && !phone) {
            return res.status(400).json({ success: false, message: 'Email or phone is required' });
        }

        const existingUser = email
            ? await User.findOne({ email: email.toLowerCase() })
            : await User.findOne({ phone });

        if (existingUser) {
            return res.status(409).json({ success: false, message: 'Account already exists with this email/phone' });
        }

        const user = new User({ name, email, phone, age, passwordHash: password });
        await user.save();

        const accessToken = signAccess(user._id);
        const refreshToken = signRefresh(user._id);
        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        return res.status(201).json({
            success: true,
            token: accessToken,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                age: user.age,
                isOnboarded: user.isOnboarded,
                membership: user.membership,
                photos: user.photos,
            },
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
    try {
        const { email, phone, password } = req.body;

        if (!password || (!email && !phone)) {
            return res.status(400).json({ success: false, message: 'Credentials are required' });
        }

        const query = email ? { email: email.toLowerCase() } : { phone };
        const user = await User.findOne(query).select('+passwordHash').select('+refreshToken');

        if (!user || user.isDeleted) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        user.lastActive = Date.now();
        const accessToken = signAccess(user._id);
        const refreshToken = signRefresh(user._id);
        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        return res.json({
            success: true,
            token: accessToken,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                age: user.age,
                bio: user.bio,
                photos: user.photos,
                interests: user.interests,
                isOnboarded: user.isOnboarded,
                membership: user.membership,
                verified: user.verified,
                badges: user.badges,
            },
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Refresh access token
// @route   POST /api/auth/refresh
// @access  Public (via httpOnly cookie)
const refreshToken = async (req, res, next) => {
    try {
        const token = req.cookies?.refreshToken || req.body.refreshToken;
        if (!token) return res.status(401).json({ success: false, message: 'No refresh token' });

        const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
        const user = await User.findById(decoded.id).select('+refreshToken');

        if (!user || user.refreshToken !== token) {
            return res.status(401).json({ success: false, message: 'Invalid refresh token' });
        }

        const newAccessToken = signAccess(user._id);
        return res.json({ success: true, token: newAccessToken });
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Token expired or invalid' });
    }
};

// @desc    Logout
// @route   POST /api/auth/logout
// @access  Private
const logout = async (req, res, next) => {
    try {
        await User.findByIdAndUpdate(req.user._id, { refreshToken: null });
        res.clearCookie('refreshToken');
        return res.json({ success: true, message: 'Logged out successfully' });
    } catch (err) {
        next(err);
    }
};

// @desc    Forgot password — send reset email
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email: email?.toLowerCase() });

        // Always respond 200 to prevent email enumeration
        if (!user) return res.json({ success: true, message: 'If that email exists, a reset link was sent.' });

        const resetToken = crypto.randomBytes(32).toString('hex');
        const hash = crypto.createHash('sha256').update(resetToken).digest('hex');

        user.resetPasswordToken = hash;
        user.resetPasswordExpires = Date.now() + 30 * 60 * 1000; // 30 min
        await user.save({ validateBeforeSave: false });

        const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;
        await sendEmail({
            to: user.email,
            subject: 'Inakkam – Reset Your Password',
            html: `<p>Hi ${user.name},</p>
             <p>Click <a href="${resetUrl}">here</a> to reset your password. Link expires in 30 minutes.</p>
             <p>If you did not request this, ignore this email.</p>`,
        });

        return res.json({ success: true, message: 'If that email exists, a reset link was sent.' });
    } catch (err) {
        next(err);
    }
};

// @desc    Reset password
// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword = async (req, res, next) => {
    try {
        const { token, password } = req.body;
        const hash = crypto.createHash('sha256').update(token).digest('hex');

        const user = await User.findOne({
            resetPasswordToken: hash,
            resetPasswordExpires: { $gt: Date.now() },
        });

        if (!user) return res.status(400).json({ success: false, message: 'Token invalid or expired' });

        user.passwordHash = password; // will be hashed by pre-save hook
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        user.refreshToken = undefined; // invalidate all sessions
        await user.save();

        return res.json({ success: true, message: 'Password reset successful. Please log in.' });
    } catch (err) {
        next(err);
    }
};

// @desc    Send OTP (Simulation)
// @route   POST /api/auth/send-otp
// @access  Private/Public
const sendOtp = async (req, res, next) => {
    try {
        const { phone } = req.body;
        if (!phone) return res.status(400).json({ success: false, message: 'Phone number is required' });

        // Generate a 5 digit OTP
        const otp = Math.floor(10000 + Math.random() * 90000).toString();

        // Store it with a 5-minute expiration
        otpStore.set(phone, { otp, expiresAt: Date.now() + 5 * 60 * 1000 });

        // Simulate sending SMS (In production, you'd use Twilio here)
        console.log(`\n=========================================`);
        console.log(`📱 MOCK SMS SERVICE (Twilio Placeholder)`);
        console.log(`To: +91 ${phone}`);
        console.log(`Message: Your Inakkam verification code is ${otp}`);
        console.log(`=========================================\n`);

        return res.json({ success: true, message: 'OTP sent successfully (Check terminal)' });
    } catch (err) {
        next(err);
    }
};

// @desc    Verify OTP
// @route   POST /api/auth/verify-otp
// @access  Private/Public
const verifyOtp = async (req, res, next) => {
    try {
        const { phone, otp } = req.body;
        if (!phone || !otp) return res.status(400).json({ success: false, message: 'Phone and OTP are required' });

        const record = otpStore.get(phone);
        if (!record) {
            return res.status(400).json({ success: false, message: 'OTP expired or not sent' });
        }

        if (Date.now() > record.expiresAt) {
            otpStore.delete(phone);
            return res.status(400).json({ success: false, message: 'OTP expired' });
        }

        if (record.otp !== otp) {
            return res.status(400).json({ success: false, message: 'Invalid OTP' });
        }

        // Clean up after successful verification
        otpStore.delete(phone);

        // Update user if they are logged in
        if (req.user) {
            await User.findByIdAndUpdate(req.user._id, { phone, verified: true });
        }

        return res.json({ success: true, message: 'Phone number verified successfully' });
    } catch (err) {
        next(err);
    }
};

module.exports = { register, login, refreshToken, logout, forgotPassword, resetPassword, sendOtp, verifyOtp };
