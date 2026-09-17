const Page = require('../models/Page');

// Get all active public pages
exports.getPublicPages = async (req, res) => {
    try {
        const pages = await Page.find({ status: 1 }).select('title slug updatedAt').sort({ createdAt: -1 });
        res.json({ success: true, pages });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch pages' });
    }
};

// Get single page by slug
exports.getPageBySlug = async (req, res) => {
    try {
        const page = await Page.findOne({ slug: req.params.slug, status: 1 });
        if (!page) return res.status(404).json({ success: false, message: 'Page not found' });
        res.json({ success: true, page });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch page' });
    }
};
