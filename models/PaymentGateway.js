const mongoose = require('mongoose');

const paymentGatewaySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    subtitle: { type: String, default: '' },
    image: { type: String, default: '' },
    status: { type: Number, enum: [0, 1], default: 1 }, // 1 = Active, 0 = Inactive
    showOnWallet: { type: Number, enum: [0, 1], default: 1 }, // 1 = Yes, 0 = No
}, { timestamps: true });

module.exports = mongoose.model('PaymentGateway', paymentGatewaySchema);
