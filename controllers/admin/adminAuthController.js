const Admin = require('../../models/Admin');
const jwt = require('jsonwebtoken');

const signAdminToken = (id) => {
    const secret = process.env.ADMIN_JWT_SECRET || process.env.JWT_ACCESS_SECRET;
    return jwt.sign({ id }, secret, { expiresIn: '1d' });
};

// @desc    Admin Login
// @route   POST /api/admin/login
const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required' });
        }

        const admin = await Admin.findOne({ email: email.toLowerCase() }).select('+passwordHash');
        if (!admin || !admin.isActive) {
            return res.status(401).json({ success: false, message: 'Invalid admin credentials or account disabled' });
        }

        const isMatch = await admin.matchPassword(password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
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
    } catch (err) {
        next(err);
    }
};

// @desc    Get Current Admin
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
                permissions: admin.permissions,
                avatar: admin.avatar,
            }
        });
    } catch (err) {
        next(err);
    }
};

module.exports = { login, getMe };
