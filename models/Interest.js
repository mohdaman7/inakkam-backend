const mongoose = require('mongoose');

const interestSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true, unique: true },
    image: { type: String, default: '' },
    status: { type: Number, enum: [0, 1], default: 1 }, // 1 = published, 0 = unpublished
    sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Interest', interestSchema);
