const User = require('../../models/User');
const Notification = require('../../models/Notification');

// @desc    Send push / in-app notification to users
// @route   POST /api/admin/push-notification
const sendPushNotification = async (req, res, next) => {
    try {
        const { title, message, target, userId } = req.body;
        if (!title || !message) {
            return res.status(400).json({ success: false, message: 'Title and message are required' });
        }

        const imageUrl = req.file ? req.file.path : '';

        let query = { isDeleted: false };
        if (target === 'user') {
            if (!userId) {
                return res.status(400).json({ success: false, message: 'User ID or Email is required for target audience user' });
            }
            query = {
                $or: [
                    { _id: userId.match(/^[0-9a-fA-F]{24}$/) ? userId : null },
                    { email: userId.toLowerCase().trim() },
                    { phone: userId.trim() },
                ].filter(Boolean)
            };
        }

        const targetUsers = await User.find(query).select('_id');
        if (targetUsers.length === 0) {
            return res.status(404).json({ success: false, message: 'No target users found' });
        }

        const notifications = targetUsers.map(user => ({
            recipient: user._id,
            type: 'system',
            text: `${title}: ${message}`,
            meta: { imageUrl }
        }));

        await Notification.insertMany(notifications);

        return res.json({ success: true, message: `System notification dispatched to ${targetUsers.length} users successfully.` });
    } catch (err) {
        next(err);
    }
};

module.exports = { sendPushNotification };
