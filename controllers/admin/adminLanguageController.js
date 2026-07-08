const Language = require('../../models/Language');

// @desc    Get all languages
// @route   GET /api/admin/languages
const getLanguages = async (req, res, next) => {
    try {
        const languages = await Language.find().sort({ sortOrder: 1, createdAt: -1 });
        return res.json({ success: true, languages });
    } catch (err) {
        next(err);
    }
};

// @desc    Create language
// @route   POST /api/admin/languages
const createLanguage = async (req, res, next) => {
    try {
        const { title, status } = req.body;
        if (!title) {
            return res.status(400).json({ success: false, message: 'Title is required' });
        }

        const imageUrl = req.file ? req.file.path : '';

        const language = await Language.create({
            title: title.trim(),
            status: status !== undefined ? Number(status) : 1,
            image: imageUrl,
        });

        return res.status(201).json({ success: true, language });
    } catch (err) {
        next(err);
    }
};

// @desc    Update language
// @route   PUT /api/admin/languages/:id
const updateLanguage = async (req, res, next) => {
    try {
        const { title, status } = req.body;
        const language = await Language.findById(req.params.id);
        if (!language) {
            return res.status(404).json({ success: false, message: 'Language not found' });
        }

        if (title) language.title = title.trim();
        if (status !== undefined) language.status = Number(status);
        if (req.file) language.image = req.file.path;

        await language.save();
        return res.json({ success: true, language });
    } catch (err) {
        next(err);
    }
};

// @desc    Delete language
// @route   DELETE /api/admin/languages/:id
const deleteLanguage = async (req, res, next) => {
    try {
        const language = await Language.findByIdAndDelete(req.params.id);
        if (!language) {
            return res.status(404).json({ success: false, message: 'Language not found' });
        }
        return res.json({ success: true, message: 'Language deleted successfully' });
    } catch (err) {
        next(err);
    }
};

module.exports = { getLanguages, createLanguage, updateLanguage, deleteLanguage };
