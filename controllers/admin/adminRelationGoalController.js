const RelationGoal = require('../../models/RelationGoal');

// @desc    Get all relation goals
// @route   GET /api/admin/relation-goals
const getRelationGoals = async (req, res, next) => {
    try {
        const goals = await RelationGoal.find().sort({ sortOrder: 1, createdAt: -1 });
        return res.json({ success: true, goals });
    } catch (err) {
        next(err);
    }
};

// @desc    Create relation goal
// @route   POST /api/admin/relation-goals
const createRelationGoal = async (req, res, next) => {
    try {
        const { title, subtitle, status } = req.body;
        if (!title) {
            return res.status(400).json({ success: false, message: 'Title is required' });
        }

        const goal = await RelationGoal.create({
            title: title.trim(),
            subtitle: subtitle ? subtitle.trim() : '',
            status: status !== undefined ? Number(status) : 1,
        });

        return res.status(201).json({ success: true, goal });
    } catch (err) {
        next(err);
    }
};

// @desc    Update relation goal
// @route   PUT /api/admin/relation-goals/:id
const updateRelationGoal = async (req, res, next) => {
    try {
        const { title, subtitle, status } = req.body;
        const goal = await RelationGoal.findById(req.params.id);
        if (!goal) {
            return res.status(404).json({ success: false, message: 'Relation goal not found' });
        }

        if (title) goal.title = title.trim();
        if (subtitle !== undefined) goal.subtitle = subtitle.trim();
        if (status !== undefined) goal.status = Number(status);

        await goal.save();
        return res.json({ success: true, goal });
    } catch (err) {
        next(err);
    }
};

// @desc    Delete relation goal
// @route   DELETE /api/admin/relation-goals/:id
const deleteRelationGoal = async (req, res, next) => {
    try {
        const goal = await RelationGoal.findByIdAndDelete(req.params.id);
        if (!goal) {
            return res.status(404).json({ success: false, message: 'Relation goal not found' });
        }
        return res.json({ success: true, message: 'Relation goal deleted successfully' });
    } catch (err) {
        next(err);
    }
};

module.exports = { getRelationGoals, createRelationGoal, updateRelationGoal, deleteRelationGoal };
