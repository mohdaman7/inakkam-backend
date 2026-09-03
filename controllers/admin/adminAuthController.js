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
        const inputIdentifier = req.body.email || req.body.username || req.body.identifier;
        const password = req.body.password;
        if (!inputIdentifier || !password) {
            return res.status(400).json({ success: false, message: 'Email/Username and password are required' });
        }

        const normalizedInput = inputIdentifier.toLowerCase().trim();
        const possibleEmails = [normalizedInput];

        if (normalizedInput === 'admin') {
            possibleEmails.push('admin@inakkam.com', 'admin@gmail.com');
        } else if (normalizedInput === 'admin@gmail.com') {
            possibleEmails.push('admin@inakkam.com');
        } else if (normalizedInput === 'admin@inakkam.com') {
            possibleEmails.push('admin@gmail.com');
        }

        // 1. Try Admin collection first
        let admin = await Admin.findOne({ email: { $in: possibleEmails } }).select('+passwordHash');

        // Auto-bootstrap default superadmin if no admin exists or using default demo credentials
        const isDefaultDemoPassword = (password === 'admin123' || password === 'admin@123');
        const isDefaultAdminIdentifier = (
            normalizedInput === 'admin' ||
            normalizedInput === 'admin@gmail.com' ||
            normalizedInput === 'admin@inakkam.com'
        );

        if (!admin) {
            const adminCount = await Admin.countDocuments();
            if (adminCount === 0 || (isDefaultDemoPassword && isDefaultAdminIdentifier)) {
                admin = await Admin.create({
                    name: 'Administrator',
                    email: normalizedInput.includes('@') ? normalizedInput : 'admin@gmail.com',
                    passwordHash: password,
                    role: 'superadmin',
                    permissions: { all: true },
                });
            }
        }

        if (admin) {
            if (!admin.isActive) {
                return res.status(401).json({ success: false, message: 'Account is disabled. Please contact administrator.' });
            }

            let isMatch = await admin.matchPassword(password);
            
            // Allow default password reset/fallback for standard demo accounts (admin123 or admin@123)
            if (!isMatch && isDefaultDemoPassword && (admin.email === 'admin@inakkam.com' || admin.email === 'admin@gmail.com')) {
                admin.passwordHash = password;
                await admin.save();
                isMatch = true;
            }

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
            email: { $in: possibleEmails },
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
