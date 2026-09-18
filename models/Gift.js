const mongoose = require('mongoose');

const giftSchema = new mongoose.Schema({
    title: { type: String, default: 'Free Coin Gift Drop' },
    description: { type: String, default: 'Claim your free coins before the timer expires!' },
    image: { type: String, default: '' },
    coinCost: { type: Number, default: 50 },
    coinReward: { type: Number, default: 50 },
    type: { type: String, enum: ['free_claim', 'virtual_gift'], default: 'free_claim' },
    durationHours: { type: Number, default: 24 }, // e.g. 1h, 7h, 24h, 72h
    expiresAt: { type: Date },
    status: { type: Number, enum: [0, 1], default: 1 }, // 1 = Active/Live, 0 = Unpublished/Hidden
    claimedBy: [
        {
            user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            claimedAt: { type: Date, default: Date.now }
        }
    ],
    totalClaims: { type: Number, default: 0 },
    maxClaims: { type: Number, default: 0 }, // 0 = unlimited
    sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

giftSchema.virtual('isExpired').get(function () {
    if (!this.expiresAt) return false;
    return new Date() > new Date(this.expiresAt);
});

module.exports = mongoose.model('Gift', giftSchema);
