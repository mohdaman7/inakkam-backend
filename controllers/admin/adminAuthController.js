const Admin = require('../../models/Admin');
const User = require('../../models/User');
const jwt = require('jsonwebtoken');

const signAdminToken = (id) => {
    const secret = process.env.ADMIN_JWT_SECRET || process.env.JWT_ACCESS_SECRET;
    return jwt.sign({ id }, secret, { expiresIn: '1d' });
};

// @desc    Admin / Agent Login
// @route   POST /api/admin/login
const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required' });
        }

        const normalizedEmail = email.toLowerCase().trim();

        // 1. Try Admin collection first
        const admin = await Admin.findOne({ email: normalizedEmail }).select('+passwordHash');
        if (admin) {
            if (!admin.isActive) {
                return res.status(401).json({ success: false, message: 'Account is disabled. Please contact administrator.' });
            }

            const isMatch = await admin.matchPassword(password);
            if (!isMatch) {
                return res.status(401).json({ success: false, message: 'Invalid credentials' });
            }

            admin.lastLogin = new Date();
            await admin.save();

            const token = signAdminToken(admin._id);
            return res.json({
                success: true,
                token,
                admin: {
                    _id: admin._id,
                    name: admin.name,
                    email: admin.email,
                    role: admin.role,
                    permissions: admin.permissions,
                    avatar: admin.avatar,
                }
            });
        }

        // 2. Try User collection for Elite Agent / Staff
        const agentUser = await User.findOne({ 
            email: normalizedEmail,
            $or: [{ isEliteAgent: true }, { isStaff: true }, { role: 'staff' }]
        }).select('+passwordHash');

        if (!agentUser || agentUser.isDeleted) {
            return res.status(401).json({ success: false, message: 'Invalid credentials or agent account not found' });
        }

        const isMatch = await agentUser.matchPassword(password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        agentUser.lastActive = new Date();
        await agentUser.save();

        const token = signAdminToken(agentUser._id);
        const avatarUrl = (agentUser.photos && agentUser.photos.length > 0) ? agentUser.photos[0].url : '';

        return res.json({
            success: true,
            token,
            admin: {
                _id: agentUser._id,
                name: agentUser.name,
                email: agentUser.email,
                role: 'agent',
                isEliteAgent: true,
                isStaff: agentUser.isStaff || false,
                avatar: avatarUrl,
                phone: agentUser.phone,
                gender: agentUser.gender || 'Woman',
                wallet: agentUser.wallet || {},
                payoutDetails: agentUser.payoutDetails || {},
                permissions: {
                    eliteAgent_Read: true,
                    payout_Read: true,
                    payout_Write: true
                }
            }
        });

    } catch (err) {
        next(err);
    }
};

// @desc    Get Current Admin or Agent
// @route   GET /api/admin/me
const getMe = async (req, res, next) => {
    try {
        const admin = req.admin;
        return res.json({
            success: true,
            admin: {
                _id: admin._id,
                name: admin.name,
                email: admin.email,
                role: admin.role,
                isEliteAgent: admin.isEliteAgent || false,
                permissions: admin.permissions || {},
                avatar: admin.avatar || '',
                wallet: admin.wallet || {},
                payoutDetails: admin.payoutDetails || {},
            }
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Update Admin Profile
// @route   PUT /api/admin/profile
const updateProfile = async (req, res, next) => {
    try {
        const { name, email, password } = req.body;
        const admin = await Admin.findById(req.admin._id).select('+passwordHash');
        if (!admin) {
            return res.status(404).json({ success: false, message: 'Admin not found' });
        }

        if (name) admin.name = name.trim();
        if (email) admin.email = email.toLowerCase().trim();
        if (password && password.trim()) admin.passwordHash = password;
        if (req.file) admin.avatar = req.file.path;

        await admin.save();

        return res.json({
            success: true,
            message: 'Profile updated successfully',
            admin: {
                _id: admin._id,
                name: admin.name,
                email: admin.email,
                role: admin.role,
                permissions: admin.permissions,
                avatar: admin.avatar,
            }
        });
    } catch (err) {
        next(err);
    }
};

module.exports = { login, getMe, updateProfile };
