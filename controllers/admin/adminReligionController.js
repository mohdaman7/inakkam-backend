const Religion = require('../../models/Religion');

// @desc    Get all religions
// @route   GET /api/admin/religions
const getReligions = async (req, res, next) => {
    try {
        const religions = await Religion.find().sort({ sortOrder: 1, createdAt: -1 });
        return res.json({ success: true, religions });
    } catch (err) {
        next(err);
    }
};

// @desc    Create religion
// @route   POST /api/admin/religions
const createReligion = async (req, res, next) => {
    try {
        const { title, status } = req.body;
        if (!title) {
            return res.status(400).json({ success: false, message: 'Title is required' });
        }

        const religion = await Religion.create({
            title: title.trim(),
            status: status !== undefined ? Number(status) : 1,
        });

        return res.status(201).json({ success: true, religion });
    } catch (err) {
        next(err);
    }
};

// @desc    Update religion
// @route   PUT /api/admin/religions/:id
const updateReligion = async (req, res, next) => {
    try {
        const { title, status } = req.body;
        const religion = await Religion.findById(req.params.id);
        if (!religion) {
            return res.status(404).json({ success: false, message: 'Religion not found' });
        }

        if (title) religion.title = title.trim();
        if (status !== undefined) religion.status = Number(status);

        await religion.save();
        return res.json({ success: true, religion });
    } catch (err) {
        next(err);
    }
};

// @desc    Delete religion
// @route   DELETE /api/admin/religions/:id
const deleteReligion = async (req, res, next) => {
    try {
        const religion = await Religion.findByIdAndDelete(req.params.id);
        if (!religion) {
            return res.status(404).json({ success: false, message: 'Religion not found' });
        }
        return res.json({ success: true, message: 'Religion deleted successfully' });
    } catch (err) {
        next(err);
    }
};

module.exports = { getReligions, createReligion, updateReligion, deleteReligion };
