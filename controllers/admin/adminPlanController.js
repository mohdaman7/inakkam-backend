const Plan = require('../../models/Plan');

// @desc    Get all plans
// @route   GET /api/admin/plans
const getPlans = async (req, res, next) => {
    try {
        const plans = await Plan.find().sort({ sortOrder: 1, createdAt: -1 });
        return res.json({ success: true, plans });
    } catch (err) {
        next(err);
    }
};

// @desc    Create plan
// @route   POST /api/admin/plans
const createPlan = async (req, res, next) => {
    try {
        const { title, amount, dayLimit, description, filterInclude, audioVideo, directChat, chat, likeMenu, status } = req.body;
        if (!title || amount === undefined || dayLimit === undefined) {
            return res.status(400).json({ success: false, message: 'Title, Amount, and Day Limit are required' });
        }

        const plan = await Plan.create({
            title: title.trim(),
            amount: Number(amount),
            dayLimit: Number(dayLimit),
            description: description ? description.trim() : '',
            filterInclude: !!filterInclude,
            audioVideo: !!audioVideo,
            directChat: !!directChat,
            chat: !!chat,
            likeMenu: !!likeMenu,
            status: status !== undefined ? Number(status) : 1,
        });

        return res.status(201).json({ success: true, plan });
    } catch (err) {
        next(err);
    }
};

// @desc    Update plan
// @route   PUT /api/admin/plans/:id
const updatePlan = async (req, res, next) => {
    try {
        const { title, amount, dayLimit, description, filterInclude, audioVideo, directChat, chat, likeMenu, status } = req.body;
        const plan = await Plan.findById(req.params.id);
        if (!plan) {
            return res.status(404).json({ success: false, message: 'Plan not found' });
        }

        if (title !== undefined) plan.title = title.trim();
        if (amount !== undefined) plan.amount = Number(amount);
        if (dayLimit !== undefined) plan.dayLimit = Number(dayLimit);
        if (description !== undefined) plan.description = description.trim();
        if (filterInclude !== undefined) plan.filterInclude = !!filterInclude;
        if (audioVideo !== undefined) plan.audioVideo = !!audioVideo;
        if (directChat !== undefined) plan.directChat = !!directChat;
        if (chat !== undefined) plan.chat = !!chat;
        if (likeMenu !== undefined) plan.likeMenu = !!likeMenu;
        if (status !== undefined) plan.status = Number(status);

        await plan.save();
        return res.json({ success: true, plan });
    } catch (err) {
        next(err);
    }
};

// @desc    Delete plan
// @route   DELETE /api/admin/plans/:id
const deletePlan = async (req, res, next) => {
    try {
        const plan = await Plan.findByIdAndDelete(req.params.id);
        if (!plan) {
            return res.status(404).json({ success: false, message: 'Plan not found' });
        }
        return res.json({ success: true, message: 'Plan deleted successfully' });
    } catch (err) {
        next(err);
    }
};

module.exports = { getPlans, createPlan, updatePlan, deletePlan };
