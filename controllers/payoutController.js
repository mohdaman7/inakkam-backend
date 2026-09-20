const Payout = require('../models/Payout');
const User = require('../models/User');

// @desc    Request withdrawal payout for staff
// @route   POST /api/payout/request
const requestPayout = async (req, res, next) => {
    try {
        const { coins, amount, transferType, upiId, accountNumber, ifsc, bankName } = req.body;
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const requestedCoins = Number(coins) || (Number(amount) * 3);
        const requestedRupees = Number(amount) || (requestedCoins / 3);

        const currentEarnedCoins = user.wallet?.earnedCoins || 0;
        if (currentEarnedCoins < requestedCoins) {
            return res.status(400).json({
                success: false,
                message: `Insufficient earned coins. You have ${currentEarnedCoins} coins (₹${(currentEarnedCoins / 3).toFixed(2)}), but requested ${requestedCoins} coins.`
            });
        }

        if (requestedRupees < 100) {
            return res.status(400).json({
                success: false,
                message: 'Minimum withdrawal amount is ₹100 (300 coins).'
            });
        }

        // Update user payout details
        if (!user.payoutDetails) user.payoutDetails = {};
        if (upiId) user.payoutDetails.upiId = upiId;
        if (accountNumber) user.payoutDetails.accountNumber = accountNumber;
        if (ifsc) user.payoutDetails.ifsc = ifsc;
        if (bankName) user.payoutDetails.bankName = bankName;

        // Deduct coins & increase pending payout
        user.wallet.earnedCoins = currentEarnedCoins - requestedCoins;
        user.wallet.pendingPayout = (user.wallet.pendingPayout || 0) + requestedRupees;
        await user.save();

        // Create Payout Record
        const payoutRecord = await Payout.create({
            userId: user._id,
            userName: user.name,
            amount: requestedRupees,
            coin: requestedCoins,
            transferType: transferType || (upiId ? 'UPI' : 'Bank'),
            mobile: user.phone || '',
            payoutDetails: {
                upiId: upiId || user.payoutDetails?.upiId || '',
                bankName: bankName || user.payoutDetails?.bankName || '',
                accountNumber: accountNumber || user.payoutDetails?.accountNumber || '',
                ifsc: ifsc || user.payoutDetails?.ifsc || '',
                accountHolderName: user.name || ''
            },
            status: 'Pending'
        });

        return res.json({
            success: true,
            message: `Withdrawal request of ₹${requestedRupees} (${requestedCoins} coins) submitted successfully!`,
            payout: payoutRecord,
            remainingEarnedCoins: user.wallet.earnedCoins
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Get staff payout history and wallet summary
// @route   GET /api/payout/my-payouts
const getMyPayouts = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id).lean();
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const payouts = await Payout.find({ userId: req.user._id }).sort({ createdAt: -1 }).lean();

        const wallet = user.wallet || {};
        const earnedCoins = wallet.earnedCoins || 0;
        const rupeeValue = Math.floor((earnedCoins / 3) * 100) / 100; // Staff rate: ₹1 = 3 coins

        return res.json({
            success: true,
            summary: {
                userCoins: wallet.balance || 0,
                earnedCoins,
                rupeeValue,
                todayCoins: wallet.todayCoins || 0,
                weeklyCoins: wallet.weeklyCoins || 0,
                monthlyCoins: wallet.monthlyCoins || 0,
                lifetimeEarnings: wallet.lifetimeEarnings || 0,
                pendingPayout: wallet.pendingPayout || 0,
                paidAmount: wallet.paidAmount || 0,
                payoutDetails: user.payoutDetails || {}
            },
            history: payouts
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Update staff payout details (bank / UPI)
// @route   PUT /api/payout/details
// @route   POST /api/payout/details
const updatePayoutDetails = async (req, res, next) => {
    try {
        const { bankName, accountNumber, ifsc, upiId } = req.body;
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        if (!user.payoutDetails) user.payoutDetails = {};
        if (bankName !== undefined) user.payoutDetails.bankName = bankName;
        if (accountNumber !== undefined) user.payoutDetails.accountNumber = accountNumber;
        if (ifsc !== undefined) user.payoutDetails.ifsc = ifsc;
        if (upiId !== undefined) user.payoutDetails.upiId = upiId;

        await user.save();

        return res.json({
            success: true,
            message: 'Payout details updated successfully',
            payoutDetails: user.payoutDetails
        });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    requestPayout,
    getMyPayouts,
    updatePayoutDetails
};
