const Report = require('../models/Report');
const User = require('../models/User');

// @desc    Submit a report against another user
// @route   POST /api/reports
// @access  Private
const createReport = async (req, res, next) => {
    try {
        const { reportedUserId, reason, description } = req.body;
        if (!reportedUserId || !reason) {
            return res.status(400).json({ success: false, message: 'reportedUserId and reason are required' });
        }

        const reportedUser = await User.findById(reportedUserId);
        if (!reportedUser || reportedUser.isDeleted) {
            return res.status(404).json({ success: false, message: 'Reported user not found' });
        }

        if (reportedUserId === req.user._id.toString()) {
            return res.status(400).json({ success: false, message: 'You cannot report yourself' });
        }

        const report = await Report.create({
            reporter: req.user._id,
            reported: reportedUserId,
            reason,
            description: description || '',
        });

        return res.status(201).json({ success: true, report, message: 'Report submitted successfully. We will review it shortly.' });
    } catch (err) {
        next(err);
    }
};

module.exports = { createReport };
