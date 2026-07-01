const FAQ = require('../../models/FAQ');

// @desc    Get all FAQs
// @route   GET /api/admin/faqs
const getFaqs = async (req, res, next) => {
    try {
        const faqs = await FAQ.find().sort({ sortOrder: 1, createdAt: -1 });
        return res.json({ success: true, faqs });
    } catch (err) {
        next(err);
    }
};

// @desc    Create FAQ
// @route   POST /api/admin/faqs
const createFaq = async (req, res, next) => {
    try {
        const { question, answer, status } = req.body;
        if (!question || !answer) {
            return res.status(400).json({ success: false, message: 'Question and Answer are required' });
        }

        const faq = await FAQ.create({
            question: question.trim(),
            answer: answer.trim(),
            status: status !== undefined ? Number(status) : 1,
        });

        return res.status(201).json({ success: true, faq });
    } catch (err) {
        next(err);
    }
};

// @desc    Update FAQ
// @route   PUT /api/admin/faqs/:id
const updateFaq = async (req, res, next) => {
    try {
        const { question, answer, status } = req.body;
        const faq = await FAQ.findById(req.params.id);
        if (!faq) {
            return res.status(404).json({ success: false, message: 'FAQ not found' });
        }

        if (question) faq.question = question.trim();
        if (answer) faq.answer = answer.trim();
        if (status !== undefined) faq.status = Number(status);

        await faq.save();
        return res.json({ success: true, faq });
    } catch (err) {
        next(err);
    }
};

// @desc    Delete FAQ
// @route   DELETE /api/admin/faqs/:id
const deleteFaq = async (req, res, next) => {
    try {
        const faq = await FAQ.findByIdAndDelete(req.params.id);
        if (!faq) {
            return res.status(404).json({ success: false, message: 'FAQ not found' });
        }
        return res.json({ success: true, message: 'FAQ deleted successfully' });
    } catch (err) {
        next(err);
    }
};

module.exports = { getFaqs, createFaq, updateFaq, deleteFaq };
