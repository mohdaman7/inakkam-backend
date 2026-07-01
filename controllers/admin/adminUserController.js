const User = require('../../models/User');

// @desc    Get user list
// @route   GET /api/admin/users
const getUsers = async (req, res, next) => {
    try {
        const users = await User.find({ isDeleted: false })
            .select('name email gender age membership isOnline createdAt blockedUsers')
            .sort({ createdAt: -1 })
            .lean();

        // Format to match DataTable expectations
        const formatted = users.map(u => ({
            _id: u._id,
            name: u.name,
            email: u.email || 'N/A',
            gender: u.gender || 'N/A',
            age: u.age || 'N/A',
            membership: u.membership?.plan || 'free',
            isOnline: !!u.isOnline,
            createdAt: new Date(u.createdAt).toLocaleDateString(),
        }));

        return res.json({ success: true, users: formatted });
    } catch (err) {
        next(err);
    }
};

// @desc    Block / Unblock user
// @route   PATCH /api/admin/users/:id/block
const toggleBlockUser = async (req, res, next) => {
    try {
        const { blocked } = req.body; // boolean
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        user.isDeleted = !!blocked; // Soft delete or toggle block status
        await user.save();

        return res.json({ success: true, message: `User status updated successfully` });
    } catch (err) {
        next(err);
    }
};

module.exports = { getUsers, toggleBlockUser };
