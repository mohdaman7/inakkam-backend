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
        
        let admin = await Admin.findById(decoded.id);
        if (admin && admin.isActive) {
            req.admin = admin;
            return next();
        }

        // If not found in Admin collection, check User collection for Elite Agent / Staff
        const agentUser = await User.findById(decoded.id);
        if (agentUser && !agentUser.isDeleted && (agentUser.isEliteAgent || agentUser.isStaff || agentUser.role === 'staff')) {
            req.admin = {
                _id: agentUser._id,
                name: agentUser.name,
                email: agentUser.email,
                role: 'agent',
                isEliteAgent: true,
                isStaff: agentUser.isStaff || false,
                avatar: (agentUser.photos && agentUser.photos.length > 0) ? agentUser.photos[0].url : '',
                phone: agentUser.phone,
                wallet: agentUser.wallet || {},
                payoutDetails: agentUser.payoutDetails || {},
                permissions: {
                    eliteAgent_Read: true,
                    payout_Read: true,
                    payout_Write: true
                }
            };
            req.user = agentUser;
            return next();
        }

        return res.status(401).json({ success: false, message: 'Admin or Agent account not found or inactive' });
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Authorization token invalid or expired' });
    }
};

module.exports = { protect, requirePremium, requireAdmin };
