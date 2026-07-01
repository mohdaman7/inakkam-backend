const mongoose = require('mongoose');

const payoutSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    amount: { type: Number, required: true },
    coin: { type: Number, required: true },
    transferType: { type: String, required: true, enum: ['UPI', 'Bank', 'PayPal', 'Razorpay'] },
    mobile: { type: String, default: '' },
    status: { type: String, enum: ['Pending', 'Completed'], default: 'Pending' },
}, { timestamps: true });

module.exports = mongoose.model('Payout', payoutSchema);
