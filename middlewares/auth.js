const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Admin = require('../models/Admin');

const protect = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Not authorized, no token' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
        const user = await User.findById(decoded.id).select('-passwordHash -refreshToken');
        if (!user || user.isDeleted) {
            return res.status(401).json({ success: false, message: 'User not found or deleted' });
        }
        req.user = user;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Token invalid or expired' });
    }
};

const requirePremium = (req, res, next) => {
    const plan = req.user?.membership?.plan;
    if (!plan || plan === 'free') {
        return res.status(403).json({ success: false, message: 'Premium membership required' });
    }
    next();
};

// ─── Admin Authentication Middleware ───────────────────
const requireAdmin = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Admin authorization required' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const secret = process.env.ADMIN_JWT_SECRET || process.env.JWT_ACCESS_SECRET;
        const decoded = jwt.verify(token, secret);
        const admin = await Admin.findById(decoded.id);
        if (!admin || !admin.isActive) {
            return res.status(401).json({ success: false, message: 'Admin not found or inactive' });
        }
        req.admin = admin;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Admin token invalid or expired' });
    }
};

module.exports = { protect, requirePremium, requireAdmin };
