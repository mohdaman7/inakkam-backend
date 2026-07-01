const mongoose = require('mongoose');

const packageSchema = new mongoose.Schema({
    totalCoin: { type: Number, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'USD' },
    image: { type: String, default: '' },
    status: { type: Number, enum: [0, 1], default: 1 },
    sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Package', packageSchema);
