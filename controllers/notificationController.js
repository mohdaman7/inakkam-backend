const Notification = require('../models/Notification');

// @desc    Get notifications for current user
// @route   GET /api/notifications
// @access  Private
const getNotifications = async (req, res, next) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const notifications = await Notification.find({ recipient: req.user._id })
            .populate('fromUser', 'name photos')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        const unreadCount = await Notification.countDocuments({ recipient: req.user._id, read: false });

        return res.json({ success: true, notifications, unreadCount, page: parseInt(page) });
    } catch (err) {
        next(err);
    }
};

// @desc    Mark one notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
const markRead = async (req, res, next) => {
    try {
        const n = await Notification.findOneAndUpdate(
            { _id: req.params.id, recipient: req.user._id },
            { read: true },
            { new: true }
        );
        if (!n) return res.status(404).json({ success: false, message: 'Notification not found' });
        return res.json({ success: true, notification: n });
    } catch (err) {
        next(err);
    }
};

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
const markAllRead = async (req, res, next) => {
    try {
        await Notification.updateMany({ recipient: req.user._id, read: false }, { read: true });
        return res.json({ success: true, message: 'All notifications marked as read' });
    } catch (err) {
        next(err);
    }
};

module.exports = { getNotifications, markRead, markAllRead };
