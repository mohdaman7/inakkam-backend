const Admin = require('../../models/Admin');

// @desc    Get all staff members
// @route   GET /api/admin/staff
const getStaff = async (req, res, next) => {
    try {
        // Find all admins except superadmins, or select based on roles
        const staff = await Admin.find({ role: { $ne: 'superadmin' } }).sort({ createdAt: -1 });
        
        // Format status to 0 or 1 based on isActive
        const formatted = staff.map(s => ({
            _id: s._id,
            email: s.email,
            role: s.role,
            status: s.isActive ? 1 : 0,
            permissions: s.permissions,
        }));

        return res.json({ success: true, staff: formatted });
    } catch (err) {
        next(err);
    }
};

// @desc    Create staff member
// @route   POST /api/admin/staff
const createStaff = async (req, res, next) => {
    try {
        const { email, password, status, permissions } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required' });
        }

        const existing = await Admin.findOne({ email: email.toLowerCase() });
        if (existing) {
            return res.status(409).json({ success: false, message: 'Staff user already exists' });
        }

        const staff = await Admin.create({
            name: email.split('@')[0], // Use email handle as name
            email: email.toLowerCase(),
            passwordHash: password,
            role: 'admin', // default staff role
            isActive: status !== undefined ? Number(status) === 1 : true,
            permissions: permissions || {},
        });

        return res.status(201).json({
            success: true,
            staff: {
                _id: staff._id,
                email: staff.email,
                role: staff.role,
                status: staff.isActive ? 1 : 0,
                permissions: staff.permissions,
            }
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Update staff member
// @route   PUT /api/admin/staff/:id
const updateStaff = async (req, res, next) => {
    try {
        const { email, password, status, permissions } = req.body;
        const staff = await Admin.findById(req.params.id).select('+passwordHash');
        if (!staff) {
            return res.status(404).json({ success: false, message: 'Staff member not found' });
        }

        if (email) staff.email = email.toLowerCase();
        if (password) staff.passwordHash = password; // will be hashed by pre-save hook
        if (status !== undefined) staff.isActive = Number(status) === 1;
        if (permissions !== undefined) staff.permissions = permissions;

        await staff.save();

        return res.json({
            success: true,
            staff: {
                _id: staff._id,
                email: staff.email,
                role: staff.role,
                status: staff.isActive ? 1 : 0,
                permissions: staff.permissions,
            }
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Delete staff member
// @route   DELETE /api/admin/staff/:id
const deleteStaff = async (req, res, next) => {
    try {
        const staff = await Admin.findByIdAndDelete(req.params.id);
        if (!staff) {
            return res.status(404).json({ success: false, message: 'Staff member not found' });
        }
        return res.json({ success: true, message: 'Staff member deleted successfully' });
    } catch (err) {
        next(err);
    }
};

module.exports = { getStaff, createStaff, updateStaff, deleteStaff };
