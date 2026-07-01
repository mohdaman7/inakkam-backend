const Interest = require('../../models/Interest');

// @desc    Get all interests
// @route   GET /api/admin/interests
const getInterests = async (req, res, next) => {
    try {
        const interests = await Interest.find().sort({ sortOrder: 1, createdAt: -1 });
        return res.json({ success: true, interests });
    } catch (err) {
        next(err);
    }
};

// @desc    Create interest
// @route   POST /api/admin/interests
const createInterest = async (req, res, next) => {
    try {
        const { title, status } = req.body;
        if (!title) {
            return res.status(400).json({ success: false, message: 'Title is required' });
        }

        const imageUrl = req.file ? req.file.path : '';

        const interest = await Interest.create({
            title: title.trim(),
            status: status !== undefined ? Number(status) : 1,
            image: imageUrl,
        });

        return res.status(201).json({ success: true, interest });
    } catch (err) {
        next(err);
    }
};

// @desc    Update interest
// @route   PUT /api/admin/interests/:id
const updateInterest = async (req, res, next) => {
    try {
        const { title, status } = req.body;
        const interest = await Interest.findById(req.params.id);
        if (!interest) {
            return res.status(404).json({ success: false, message: 'Interest not found' });
        }

        if (title) interest.title = title.trim();
        if (status !== undefined) interest.status = Number(status);
        if (req.file) interest.image = req.file.path;

        await interest.save();
        return res.json({ success: true, interest });
    } catch (err) {
        next(err);
    }
};

// @desc    Delete interest
// @route   DELETE /api/admin/interests/:id
const deleteInterest = async (req, res, next) => {
    try {
        const interest = await Interest.findByIdAndDelete(req.params.id);
        if (!interest) {
            return res.status(404).json({ success: false, message: 'Interest not found' });
        }
        return res.json({ success: true, message: 'Interest deleted successfully' });
    } catch (err) {
        next(err);
    }
};

module.exports = { getInterests, createInterest, updateInterest, deleteInterest };
