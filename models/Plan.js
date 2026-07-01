const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    amount: { type: Number, required: true },
    dayLimit: { type: Number, required: true },
    description: { type: String, default: '' },
    filterInclude: { type: Boolean, default: false },
    audioVideo: { type: Boolean, default: false },
    directChat: { type: Boolean, default: false },
    chat: { type: Boolean, default: false },
    likeMenu: { type: Boolean, default: false },
    status: { type: Number, enum: [0, 1], default: 1 },
    sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Plan', planSchema);
