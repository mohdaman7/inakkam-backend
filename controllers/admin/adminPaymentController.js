const Payment = require('../../models/Payment');
const Payout = require('../../models/Payout');
const PaymentGateway = require('../../models/PaymentGateway');

// @desc    Get all payment gateways
// @route   GET /api/admin/payment-gateways
const getPaymentGateways = async (req, res, next) => {
    try {
        const gateways = await PaymentGateway.find().sort({ createdAt: -1 });
        return res.json({ success: true, gateways });
    } catch (err) {
        next(err);
    }
};

// @desc    Get all payouts
// @route   GET /api/admin/payouts
const getPayouts = async (req, res, next) => {
    try {
        const payouts = await Payout.find()
            .populate('userId', 'name email phone')
            .sort({ createdAt: -1 })
            .lean();

        return res.json({ success: true, payouts });
    } catch (err) {
        next(err);
    }
};

// @desc    Process payout
// @route   PATCH /api/admin/payouts/:id/process
const processPayout = async (req, res, next) => {
    try {
        const payout = await Payout.findById(req.params.id);
        if (!payout) {
            return res.status(404).json({ success: false, message: 'Payout not found' });
        }

        payout.status = 'Completed';
        await payout.save();

        return res.json({ success: true, payout, message: 'Payout marked as completed' });
    } catch (err) {
        next(err);
    }
};

module.exports = { getPaymentGateways, getPayouts, processPayout };
