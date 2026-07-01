const mongoose = require('mongoose');

const pageSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    content: { type: String, default: '' }, // Rich text / HTML content
    status: { type: Number, enum: [0, 1], default: 1 },
}, { timestamps: true });

// Auto-generate slug from title if not provided
pageSchema.pre('validate', function () {
    if (!this.slug && this.title) {
        this.slug = this.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
    }
});

module.exports = mongoose.model('Page', pageSchema);
