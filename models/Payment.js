const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
        type: String,
        enum: ['subscription', 'coin_purchase', 'payout'],
        required: true,
    },
    planId: { type: String, default: '' },    // e.g. 'boost', 'premium', 'lifetime'
    packageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Package', default: null },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'USD' },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'refunded'],
        default: 'completed',
    },
    paymentMethod: { type: String, default: 'mock' }, // 'razorpay', 'stripe', 'mock'
    transactionId: { type: String, default: '' },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

paymentSchema.index({ user: 1, createdAt: -1 });
paymentSchema.index({ type: 1, status: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
