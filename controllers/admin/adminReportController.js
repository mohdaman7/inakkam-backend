const Report = require('../../models/Report');
const User = require('../../models/User');

// @desc    Get all reports
// @route   GET /api/admin/reports
const getReports = async (req, res, next) => {
    try {
        const reports = await Report.find()
            .populate('reporter', 'name email')
            .populate('reported', 'name email isDeleted')
            .sort({ createdAt: -1 })
            .lean();

        // Format to match dashboard UI expectations
        const formatted = reports.map(r => ({
            _id: r._id,
            reporterName: r.reporter?.name || 'Unknown',
            reportedName: r.reported?.name || 'Unknown',
            reason: r.reason,
            description: r.description || 'No description provided',
            status: r.status,
            createdAt: new Date(r.createdAt).toLocaleDateString(),
        }));

        return res.json({ success: true, reports: formatted });
    } catch (err) {
        next(err);
    }
};

// @desc    Action on report (dismiss or ban)
// @route   PATCH /api/admin/reports/:id/action
const takeReportAction = async (req, res, next) => {
    try {
        const { action } = req.body; // 'ban' or 'dismiss'
        const report = await Report.findById(req.params.id);
        if (!report) {
            return res.status(404).json({ success: false, message: 'Report not found' });
        }

        if (action === 'ban') {
            await User.findByIdAndUpdate(report.reported, { isDeleted: true });
            report.status = 'resolved';
            report.adminNote = 'User was banned.';
        } else {
            report.status = 'dismissed';
            report.adminNote = 'Report dismissed.';
        }

        report.reviewedBy = req.admin._id;
        report.reviewedAt = new Date();
        await report.save();

        return res.json({ success: true, message: `Report successfully ${report.status}` });
    } catch (err) {
        next(err);
    }
};

module.exports = { getReports, takeReportAction };
