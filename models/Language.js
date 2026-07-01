const mongoose = require('mongoose');

const languageSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true, unique: true },
    status: { type: Number, enum: [0, 1], default: 1 },
    sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Language', languageSchema);
