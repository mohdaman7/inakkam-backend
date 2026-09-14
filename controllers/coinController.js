const User = require('../models/User');
const Payment = require('../models/Payment');
const CoinRequest = require('../models/CoinRequest');
const Notification = require('../models/Notification');

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

// @desc    Purchase coin package (legacy mock)
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
            message: `Successfully purchased ${coins} coins!`
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Submit a UPI QR coin recharge request with payment screenshot
// @route   POST /api/coins/request
const submitCoinRequest = async (req, res, next) => {
    try {
        const { coins, amount, packageId, packageType, minutes, screenshotUrl, utrNumber } = req.body;

        if (!coins || !amount) {
            return res.status(400).json({ success: false, message: 'coins and amount are required' });
        }
        if (!screenshotUrl) {
            return res.status(400).json({ success: false, message: 'Payment screenshot is required' });
        }

        // Check for duplicate pending request from same user (prevent spam)
        const existingPending = await CoinRequest.findOne({ user: req.user._id, status: 'pending' });
        if (existingPending) {
            return res.status(400).json({
                success: false,
                message: 'You already have a pending coin request. Please wait for it to be processed.'
            });
        }

        const coinRequest = await CoinRequest.create({
            user: req.user._id,
            coins: Number(coins),
            amount: Number(amount),
            packageId: packageId || 'custom',
            packageType: packageType || 'recharge',
            minutes: minutes || null,
            screenshotUrl,
            utrNumber: utrNumber || '',
            status: 'pending'
        });

        return res.status(201).json({
            success: true,
            requestId: coinRequest._id,
            message: 'Coin request submitted successfully! Your coins will be credited within 30 minutes.'
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Get user own coin requests
// @route   GET /api/coins/my-requests
const getMyCoinRequests = async (req, res, next) => {
    try {
        const requests = await CoinRequest.find({ user: req.user._id })
            .sort({ createdAt: -1 })
            .limit(20)
            .select('-screenshotUrl'); // Don't send large base64 back

        return res.json({ success: true, requests });
    } catch (err) {
        next(err);
    }
};

// @desc    [ADMIN] Get all coin requests
// @route   GET /api/admin/coin-requests
const getCoinRequests = async (req, res, next) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const filter = {};
        if (status && status !== 'all') filter.status = status;

        const total = await CoinRequest.countDocuments(filter);
        const requests = await CoinRequest.find(filter)
            .populate('user', 'name email phone photos')
            .sort({ createdAt: -1 })
            .skip((Number(page) - 1) * Number(limit))
            .limit(Number(limit));

        // Pending count for badge
        const pendingCount = await CoinRequest.countDocuments({ status: 'pending' });

        return res.json({ success: true, requests, total, pendingCount });
    } catch (err) {
        next(err);
    }
};

// @desc    [ADMIN] Approve coin request - credit coins + notify user
// @route   PATCH /api/admin/coin-requests/:id/approve
const approveCoinRequest = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { note } = req.body;

        const coinRequest = await CoinRequest.findById(id);
        if (!coinRequest) {
            return res.status(404).json({ success: false, message: 'Coin request not found' });
        }
        if (coinRequest.status !== 'pending') {
            return res.status(400).json({ success: false, message: 'Request already processed' });
        }

        // Credit coins to user wallet
        const user = await User.findById(coinRequest.user);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        if (!user.wallet) user.wallet = {};
        user.wallet.balance = (user.wallet.balance || 0) + coinRequest.coins;
        await user.save();

        // Mark request approved
        coinRequest.status = 'approved';
        coinRequest.adminNote = note || '';
        coinRequest.processedBy = req.admin?._id || null;
        coinRequest.processedAt = new Date();
        await coinRequest.save();

        // Record payment
        await Payment.create({
            user: user._id,
            type: 'coin_purchase',
            planId: coinRequest.packageId || 'qr_payment',
            amount: coinRequest.amount,
            currency: 'INR',
            status: 'completed',
            paymentMethod: 'upi_qr',
            meta: {
                coinsAdded: coinRequest.coins,
                requestId: coinRequest._id,
                packageType: coinRequest.packageType
            }
        });

        // Create in-app notification for user
        await Notification.create({
            recipient: user._id,
            type: 'system',
            text: `🎉 Your payment of ₹${coinRequest.amount} was verified! ${coinRequest.coins.toLocaleString()} coins have been credited to your wallet.`,
            meta: { requestId: coinRequest._id, coinsAdded: coinRequest.coins }
        });

        return res.json({
            success: true,
            message: `${coinRequest.coins} coins credited to ${user.name || user.email}`,
            balance: user.wallet.balance
        });
    } catch (err) {
        next(err);
    }
};

// @desc    [ADMIN] Reject coin request
// @route   PATCH /api/admin/coin-requests/:id/reject
const rejectCoinRequest = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { note } = req.body;

        const coinRequest = await CoinRequest.findById(id);
        if (!coinRequest) {
            return res.status(404).json({ success: false, message: 'Coin request not found' });
        }
        if (coinRequest.status !== 'pending') {
            return res.status(400).json({ success: false, message: 'Request already processed' });
        }

        coinRequest.status = 'rejected';
        coinRequest.adminNote = note || 'Payment could not be verified.';
        coinRequest.processedBy = req.admin?._id || null;
        coinRequest.processedAt = new Date();
        await coinRequest.save();

        // Notify user
        await Notification.create({
            recipient: coinRequest.user,
            type: 'system',
            text: `❌ Your coin recharge request for ₹${coinRequest.amount} was rejected. Reason: ${coinRequest.adminNote}. Please contact support if you believe this is an error.`,
            meta: { requestId: coinRequest._id }
        });

        return res.json({ success: true, message: 'Coin request rejected and user notified.' });
    } catch (err) {
        next(err);
    }
};

// @desc    Deduct message coin
// @route   POST /api/coins/deduct-message
const deductMessageCoin = async (req, res, next) => {
    try {
        const { recipientId } = req.body;
        const sender = await User.findById(req.user._id);
        if (!sender) return res.status(404).json({ success: false, message: 'Sender not found' });

        const isSenderStaff = sender.isStaff || sender.isEliteAgent || sender.role === 'staff';
        if (isSenderStaff) {
            if (recipientId) {
                const recipient = await User.findById(recipientId);
                if (recipient && !recipient.isStaff && !recipient.isEliteAgent && recipient.role !== 'staff') {
                    const STAFF_EARNING_COINS = 6;
                    if (!sender.wallet) sender.wallet = {};
                    sender.wallet.earnedCoins = (sender.wallet.earnedCoins || 0) + STAFF_EARNING_COINS;
                    sender.wallet.todayCoins = (sender.wallet.todayCoins || 0) + STAFF_EARNING_COINS;
                    sender.wallet.weeklyCoins = (sender.wallet.weeklyCoins || 0) + STAFF_EARNING_COINS;
                    sender.wallet.monthlyCoins = (sender.wallet.monthlyCoins || 0) + STAFF_EARNING_COINS;
                    sender.wallet.lifetimeEarnings = (sender.wallet.lifetimeEarnings || 0) + 2;
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
        const MESSAGE_COST = 30;

        if (currentBalance < MESSAGE_COST) {
            return res.status(400).json({
                success: false,
                insufficientCoins: true,
                required: MESSAGE_COST,
                balance: currentBalance,
                message: `You need at least 30 coins to send a message. Current balance: ${currentBalance} coins.`
            });
        }

        if (!sender.wallet) sender.wallet = {};
        sender.wallet.balance = Math.max(0, currentBalance - MESSAGE_COST);
        await sender.save();

        if (recipientId) {
            const recipient = await User.findById(recipientId);
            if (recipient && (recipient.isStaff || recipient.isEliteAgent || recipient.role === 'staff')) {
                const STAFF_EARNING_COINS = 6;
                if (!recipient.wallet) recipient.wallet = {};
                recipient.wallet.earnedCoins = (recipient.wallet.earnedCoins || 0) + STAFF_EARNING_COINS;
                recipient.wallet.todayCoins = (recipient.wallet.todayCoins || 0) + STAFF_EARNING_COINS;
                recipient.wallet.weeklyCoins = (recipient.wallet.weeklyCoins || 0) + STAFF_EARNING_COINS;
                recipient.wallet.monthlyCoins = (recipient.wallet.monthlyCoins || 0) + STAFF_EARNING_COINS;
                recipient.wallet.lifetimeEarnings = (recipient.wallet.lifetimeEarnings || 0) + 2;
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
        const rupeeEarnings = Math.round((payoutCoinsForPeriod / 3) * 100) / 100;

        const isCallerStaff = caller.isStaff || caller.isEliteAgent || caller.role === 'staff';
        if (isCallerStaff) {
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

        if (!caller.wallet) caller.wallet = {};
        caller.wallet.balance = Math.max(0, currentBalance - costForPeriod);
        await caller.save();

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
        const { recipientId, giftValue } = req.body;
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

        sender.wallet.balance = currentBalance - giftCoins;
        await sender.save();

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
            message: 'Gift sent successfully!'
        });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getCoinPackages,
    purchaseCoins,
    submitCoinRequest,
    getMyCoinRequests,
    getCoinRequests,
    approveCoinRequest,
    rejectCoinRequest,
    deductMessageCoin,
    deductCallCoin,
    sendGift
};
