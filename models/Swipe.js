const mongoose = require('mongoose');

const swipeSchema = new mongoose.Schema({
    swiper: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    swiped: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, enum: ['left', 'right', 'superlike'], required: true },
}, { timestamps: true });

// A user can only swipe another user once
swipeSchema.index({ swiper: 1, swiped: 1 }, { unique: true });

module.exports = mongoose.model('Swipe', swipeSchema);
