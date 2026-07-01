const Page = require('../../models/Page');

// @desc    Get all pages
// @route   GET /api/admin/pages
const getPages = async (req, res, next) => {
    try {
        const pages = await Page.find().sort({ createdAt: -1 });
        return res.json({ success: true, pages });
    } catch (err) {
        next(err);
    }
};

// @desc    Create page
// @route   POST /api/admin/pages
const createPage = async (req, res, next) => {
    try {
        const { title, content, status } = req.body;
        if (!title) {
            return res.status(400).json({ success: false, message: 'Title is required' });
        }

        const page = await Page.create({
            title: title.trim(),
            content: content ? content.trim() : '',
            status: status !== undefined ? Number(status) : 1,
        });

        return res.status(201).json({ success: true, page });
    } catch (err) {
        next(err);
    }
};

// @desc    Update page
// @route   PUT /api/admin/pages/:id
const updatePage = async (req, res, next) => {
    try {
        const { title, content, status } = req.body;
        const page = await Page.findById(req.params.id);
        if (!page) {
            return res.status(404).json({ success: false, message: 'Page not found' });
        }

        if (title !== undefined) page.title = title.trim();
        if (content !== undefined) page.content = content.trim();
        if (status !== undefined) page.status = Number(status);

        await page.save();
        return res.json({ success: true, page });
    } catch (err) {
        next(err);
    }
};

// @desc    Delete page
// @route   DELETE /api/admin/pages/:id
const deletePage = async (req, res, next) => {
    try {
        const page = await Page.findByIdAndDelete(req.params.id);
        if (!page) {
            return res.status(404).json({ success: false, message: 'Page not found' });
        }
        return res.json({ success: true, message: 'Page deleted successfully' });
    } catch (err) {
        next(err);
    }
};

module.exports = { getPages, createPage, updatePage, deletePage };
