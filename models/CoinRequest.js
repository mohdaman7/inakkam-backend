const mongoose = require('mongoose');

const coinRequestSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    coins: { type: Number, required: true },
    amount: { type: Number, required: true },
    packageId: { type: String, default: '' },
    packageType: {
        type: String,
        enum: ['recharge', 'audio', 'video'],
        default: 'recharge'
    },
    minutes: { type: Number, default: null },
    screenshotUrl: { type: String, required: true },
    utrNumber: { type: String, default: '' },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    adminNote: { type: String, default: '' },
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
    processedAt: { type: Date, default: null },
}, { timestamps: true });

coinRequestSchema.index({ status: 1, createdAt: -1 });
coinRequestSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('CoinRequest', coinRequestSchema);
