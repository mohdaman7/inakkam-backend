const jwt = require('jsonwebtoken');
const User = require('../models/User');

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

module.exports = { protect, requirePremium };
