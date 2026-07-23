const User = require('../../models/User');

// @desc    Get user list with full profile info
// @route   GET /api/admin/users
const getUsers = async (req, res, next) => {
    try {
        const users = await User.find()
            .select('name email phone gender age bio work education photos interests membership verified verificationStatus isOnline isDeleted createdAt')
            .sort({ createdAt: -1 })
            .lean();

        const formatted = users.map(u => ({
            _id: u._id,
            name: u.name,
            email: u.email || 'N/A',
            phone: u.phone || 'N/A',
            gender: u.gender || 'N/A',
            age: u.age || 'N/A',
            bio: u.bio || '',
            work: u.work || '',
            education: u.education || '',
            photos: u.photos || [],
            interests: u.interests || [],
            membership: u.membership?.plan || 'free',
            verified: !!u.verified,
            verificationStatus: u.verificationStatus || 'NOT_VERIFIED',
            isOnline: !!u.isOnline,
            isDeleted: !!u.isDeleted,
            isSuspended: !!u.isDeleted,
            createdAt: new Date(u.createdAt).toLocaleDateString(),
        }));

        return res.json({ success: true, users: formatted });
    } catch (err) {
        next(err);
    }
};

// @desc    Block / Suspend / Unsuspend user
// @route   PATCH /api/admin/users/:id/block
const toggleBlockUser = async (req, res, next) => {
    try {
        const { blocked } = req.body; // boolean
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        user.isDeleted = typeof blocked === 'boolean' ? blocked : !user.isDeleted;
        await user.save();

        const actionText = user.isDeleted ? 'suspended' : 'activated';
        return res.json({ success: true, isDeleted: user.isDeleted, message: `User ${user.name} has been ${actionText}` });
    } catch (err) {
        next(err);
    }
};

module.exports = { getUsers, toggleBlockUser };
