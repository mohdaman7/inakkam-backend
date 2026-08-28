const User = require('../models/User');
const Payment = require('../models/Payment');

const COIN_PACKAGES = [
    { id: 'pkg_630', coins: 630, amount: 49, currency: 'INR' },
    { id: 'pkg_1500', coins: 1500, amount: 250, currency: 'INR' },
    { id: 'pkg_2010', coins: 2010, amount: 149, currency: 'INR' },
    { id: 'pkg_3000', coins: 3000, amount: 500, currency: 'INR' },
    { id: 'pkg_4080', coins: 4080, amount: 299, currency: 'INR' },
    { id: 'pkg_4194', coins: 4194, amount: 699, currency: 'INR' },
    { id: 'pkg_6990', coins: 6990, amount: 499, badge: 'Hot', currency: 'INR' },
    { id: 'pkg_11490', coins: 11490, amount: 799, currency: 'INR' },
    { id: 'pkg_14610', coins: 14610, amount: 999, badge: 'Popular', currency: 'INR' },
    { id: 'pkg_31050', coins: 31050, amount: 2099, currency: 'INR' },
    { id: 'pkg_60000', coins: 60000, amount: 3999, badge: 'Value', currency: 'INR' },
    { id: 'pkg_78000', coins: 78000, amount: 4999, currency: 'INR' },
];

// @desc    Get all coin purchase packages
// @route   GET /api/coins/packages
const getCoinPackages = async (req, res, next) => {
    try {
        return res.json({ success: true, packages: COIN_PACKAGES });
    } catch (err) {
        next(err);
    }
};

// @desc    Purchase coin package
// @route   POST /api/coins/purchase
const purchaseCoins = async (req, res, next) => {
    try {
        const { coins, amount, packageId } = req.body;
        if (!coins || !amount) {
            return res.status(400).json({ success: false, message: 'coins and amount are required' });
        }

        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        if (!user.wallet) user.wallet = {};
        user.wallet.balance = (user.wallet.balance || 0) + Number(coins);
        await user.save();

        // Record payment
        await Payment.create({
            user: user._id,
            type: 'coin_purchase',
            planId: packageId || 'custom',
            amount: Number(amount),
            currency: 'INR',
            status: 'completed',
            paymentMethod: 'mock',
            meta: { coinsAdded: coins }
        });

        return res.json({
            success: true,
            balance: user.wallet.balance,
            message: `Successfully purchased ${coins} coins! 🎉`
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Deduct message coin (30 coins user cost, 6 coins / ₹2 staff payout)
// @desc    Deduct message coin (30 coins user cost, 6 coins / ₹2 staff payout)
// @route   POST /api/coins/deduct-message
const deductMessageCoin = async (req, res, next) => {
    try {
        const { recipientId } = req.body;
        const sender = await User.findById(req.user._id);
        if (!sender) return res.status(404).json({ success: false, message: 'Sender not found' });

        const isSenderStaff = sender.isStaff || sender.isEliteAgent || sender.role === 'staff';
        if (isSenderStaff) {
            // Staff/Agent members pay 0 coins for messages
            // Credit the agent if messaging/replying to a regular customer
            if (recipientId) {
                const recipient = await User.findById(recipientId);
                if (recipient && !recipient.isStaff && !recipient.isEliteAgent && recipient.role !== 'staff') {
                    const STAFF_EARNING_COINS = 6; // 6 coins = ₹2
                    if (!sender.wallet) sender.wallet = {};
                    sender.wallet.earnedCoins = (sender.wallet.earnedCoins || 0) + STAFF_EARNING_COINS;
                    sender.wallet.todayCoins = (sender.wallet.todayCoins || 0) + STAFF_EARNING_COINS;
                    sender.wallet.weeklyCoins = (sender.wallet.weeklyCoins || 0) + STAFF_EARNING_COINS;
                    sender.wallet.monthlyCoins = (sender.wallet.monthlyCoins || 0) + STAFF_EARNING_COINS;
                    sender.wallet.lifetimeEarnings = (sender.wallet.lifetimeEarnings || 0) + 2; // ₹2
                    await sender.save();
                }
            }
            return res.json({
                success: true,
                isStaff: true,
                deducted: 0,
                balance: sender.wallet?.balance || 0,
                earnedCoins: sender.wallet?.earnedCoins || 0
            });
        }

        const currentBalance = sender.wallet?.balance || 0;
        const MESSAGE_COST = 30; // 30 coins = ₹5

        if (currentBalance < MESSAGE_COST) {
            return res.status(400).json({
                success: false,
                insufficientCoins: true,
                required: MESSAGE_COST,
                balance: currentBalance,
                message: `You need at least 30 coins to send a message. Current balance: ${currentBalance} coins.`
            });
        }

        // Deduct 30 coins from customer
        if (!sender.wallet) sender.wallet = {};
        sender.wallet.balance = Math.max(0, currentBalance - MESSAGE_COST);
        await sender.save();

        // Credit recipient if recipient is staff/agent
        if (recipientId) {
            const recipient = await User.findById(recipientId);
            if (recipient && (recipient.isStaff || recipient.isEliteAgent || recipient.role === 'staff')) {
                const STAFF_EARNING_COINS = 6; // 6 coins = ₹2
                if (!recipient.wallet) recipient.wallet = {};
                recipient.wallet.earnedCoins = (recipient.wallet.earnedCoins || 0) + STAFF_EARNING_COINS;
                recipient.wallet.todayCoins = (recipient.wallet.todayCoins || 0) + STAFF_EARNING_COINS;
                recipient.wallet.weeklyCoins = (recipient.wallet.weeklyCoins || 0) + STAFF_EARNING_COINS;
                recipient.wallet.monthlyCoins = (recipient.wallet.monthlyCoins || 0) + STAFF_EARNING_COINS;
                recipient.wallet.lifetimeEarnings = (recipient.wallet.lifetimeEarnings || 0) + 2; // ₹2
                await recipient.save();
            }
        }

        return res.json({
            success: true,
            deducted: MESSAGE_COST,
            balance: sender.wallet.balance
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Deduct coins per call duration
// @route   POST /api/coins/deduct-call
const deductCallCoin = async (req, res, next) => {
    try {
        const { targetUserId, callType = 'video', seconds = 20 } = req.body;
        const caller = await User.findById(req.user._id);
        if (!caller) return res.status(404).json({ success: false, message: 'Caller not found' });

        const payoutCoinsPerMin = callType === 'audio' ? 15 : 51;
        const payoutCoinsForPeriod = Math.round((payoutCoinsPerMin / 60) * Number(seconds) * 10) / 10;
        const rupeeEarnings = Math.round((payoutCoinsForPeriod / 3) * 100) / 100; // ₹1 = 3 coins

        const isCallerStaff = caller.isStaff || caller.isEliteAgent || caller.role === 'staff';
        if (isCallerStaff) {
            // Staff/Agent caller pays 0 coins
            // If recipient is regular user, credit caller agent for call time
            if (targetUserId) {
                const recipient = await User.findById(targetUserId);
                if (recipient && !recipient.isStaff && !recipient.isEliteAgent && recipient.role !== 'staff') {
                    if (!caller.wallet) caller.wallet = {};
                    caller.wallet.earnedCoins = (caller.wallet.earnedCoins || 0) + payoutCoinsForPeriod;
                    caller.wallet.todayCoins = (caller.wallet.todayCoins || 0) + payoutCoinsForPeriod;
                    caller.wallet.weeklyCoins = (caller.wallet.weeklyCoins || 0) + payoutCoinsForPeriod;
                    caller.wallet.monthlyCoins = (caller.wallet.monthlyCoins || 0) + payoutCoinsForPeriod;
                    caller.wallet.lifetimeEarnings = (caller.wallet.lifetimeEarnings || 0) + rupeeEarnings;
                    await caller.save();
                }
            }
            return res.json({
                success: true,
                isStaff: true,
                deducted: 0,
                earnedCoins: caller.wallet?.earnedCoins || 0
            });
        }

        // Cost rates per minute for regular users
        // Audio: 150 coins/min (50 coins per 20 seconds)
        // Video: 419.4 coins/min (139.8 coins per 20 seconds)
        const costPerMin = callType === 'audio' ? 150 : 419.4;
        const costForPeriod = Math.round((costPerMin / 60) * Number(seconds) * 10) / 10;

        const currentBalance = caller.wallet?.balance || 0;
        if (currentBalance < costForPeriod) {
            return res.status(400).json({
                success: false,
                insufficientCoins: true,
                required: costForPeriod,
                balance: currentBalance,
                message: `Insufficient coin balance for ${callType} call.`
            });
        }

        // Deduct from caller
        if (!caller.wallet) caller.wallet = {};
        caller.wallet.balance = Math.max(0, currentBalance - costForPeriod);
        await caller.save();

        // Credit staff recipient
        if (targetUserId) {
            const recipient = await User.findById(targetUserId);
            if (recipient && (recipient.isStaff || recipient.isEliteAgent || recipient.role === 'staff')) {
                if (!recipient.wallet) recipient.wallet = {};
                recipient.wallet.earnedCoins = (recipient.wallet.earnedCoins || 0) + payoutCoinsForPeriod;
                recipient.wallet.todayCoins = (recipient.wallet.todayCoins || 0) + payoutCoinsForPeriod;
                recipient.wallet.weeklyCoins = (recipient.wallet.weeklyCoins || 0) + payoutCoinsForPeriod;
                recipient.wallet.monthlyCoins = (recipient.wallet.monthlyCoins || 0) + payoutCoinsForPeriod;
                recipient.wallet.lifetimeEarnings = (recipient.wallet.lifetimeEarnings || 0) + rupeeEarnings;
                await recipient.save();
            }
        }

        return res.json({
            success: true,
            deducted: costForPeriod,
            balance: caller.wallet.balance
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Send gift to staff host
// @route   POST /api/coins/send-gift
const sendGift = async (req, res, next) => {
    try {
        const { recipientId, giftValue } = req.body; // giftValue: 600, 900, or 1200 coins
        const sender = await User.findById(req.user._id);
        if (!sender) return res.status(404).json({ success: false, message: 'Sender not found' });

        const giftCoins = Number(giftValue) || 600;
        const currentBalance = sender.wallet?.balance || 0;

        if (currentBalance < giftCoins) {
            return res.status(400).json({
                success: false,
                insufficientCoins: true,
                required: giftCoins,
                balance: currentBalance,
                message: `You need ${giftCoins} coins to send this gift.`
            });
        }

        // Deduct from sender
        sender.wallet.balance = currentBalance - giftCoins;
        await sender.save();

        // Credit recipient staff
        // ₹100 Gift (600 coins user) -> 150 coins (₹50) staff
        // ₹150 Gift (900 coins user) -> 225 coins (₹75) staff
        // ₹200 Gift (1200 coins user) -> 300 coins (₹100) staff
        let staffEarnCoins = 150;
        let rupeeVal = 50;
        if (giftCoins === 900) { staffEarnCoins = 225; rupeeVal = 75; }
        else if (giftCoins === 1200) { staffEarnCoins = 300; rupeeVal = 100; }

        if (recipientId) {
            const recipient = await User.findById(recipientId);
            if (recipient) {
                if (!recipient.wallet) recipient.wallet = {};
                recipient.wallet.earnedCoins = (recipient.wallet.earnedCoins || 0) + staffEarnCoins;
                recipient.wallet.todayCoins = (recipient.wallet.todayCoins || 0) + staffEarnCoins;
                recipient.wallet.lifetimeEarnings = (recipient.wallet.lifetimeEarnings || 0) + rupeeVal;
                await recipient.save();
            }
        }

        return res.json({
            success: true,
            deducted: giftCoins,
            balance: sender.wallet.balance,
            message: 'Gift sent successfully! 🎁'
        });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getCoinPackages,
    purchaseCoins,
    deductMessageCoin,
    deductCallCoin,
    sendGift
};
