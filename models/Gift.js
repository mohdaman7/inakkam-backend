const mongoose = require('mongoose');

const giftSchema = new mongoose.Schema({
    title: { type: String, default: '' },
    image: { type: String, default: '' },
    coinCost: { type: Number, default: 0 },
    status: { type: Number, enum: [0, 1], default: 1 },
    sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Gift', giftSchema);
