const Gift = require('../../models/Gift');

// @desc    Get all gifts for admin dashboard
// @route   GET /api/admin/gifts
const getGifts = async (req, res, next) => {
    try {
        const gifts = await Gift.find().sort({ createdAt: -1 }).lean();
        const now = new Date();

        const formatted = gifts.map(g => {
            const exp = g.expiresAt ? new Date(g.expiresAt) : null;
            const isExpired = exp ? now > exp : false;
            const totalClaims = (g.claimedBy && Array.isArray(g.claimedBy)) ? g.claimedBy.length : (g.totalClaims || 0);

            return {
                ...g,
                coin: g.coinReward || g.coinCost || 0,
                coinCost: g.coinCost || 0,
                coinReward: g.coinReward || g.coinCost || 0,
                isExpired,
                claimedCount: totalClaims,
                totalClaims,
                durationHours: g.durationHours || 24,
                expiresAt: g.expiresAt || null,
            };
        });

        return res.json({ success: true, gifts: formatted });
    } catch (err) {
        next(err);
    }
};

// @desc    Create a gift / coin drop
// @route   POST /api/admin/gifts
const createGift = async (req, res, next) => {
    try {
        const { title, description, coin, coinReward, durationHours, duration, expiresAt, status, type, maxClaims } = req.body;
        const coinVal = Number(coinReward !== undefined ? coinReward : (coin !== undefined ? coin : 50)) || 50;

        let parsedHours = Number(durationHours || duration);
        if (isNaN(parsedHours) || parsedHours <= 0) {
            parsedHours = 24; // default 24h / 1 day
        }

        let calculatedExpiry = null;
        if (expiresAt) {
            calculatedExpiry = new Date(expiresAt);
        } else {
            calculatedExpiry = new Date(Date.now() + parsedHours * 60 * 60 * 1000);
        }

        const imageUrl = req.file ? req.file.path : '';

        const gift = await Gift.create({
            title: title ? title.trim() : `Free ${coinVal} Coins Drop 🎁`,
            description: description ? description.trim() : 'Claim your free coin reward before the timer runs out!',
            coinCost: coinVal,
            coinReward: coinVal,
            type: type || 'free_claim',
            durationHours: parsedHours,
            expiresAt: calculatedExpiry,
            status: status !== undefined ? Number(status) : 1,
            image: imageUrl,
            maxClaims: Number(maxClaims) || 0,
            claimedBy: [],
            totalClaims: 0,
        });

        const obj = gift.toObject();
        return res.status(201).json({
            success: true,
            gift: {
                ...obj,
                coin: obj.coinReward,
                isExpired: false,
                claimedCount: 0,
            }
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Update a gift
// @route   PUT /api/admin/gifts/:id
const updateGift = async (req, res, next) => {
    try {
        const { title, description, coin, coinReward, durationHours, expiresAt, status, extendHours } = req.body;
        const gift = await Gift.findById(req.params.id);
        if (!gift) {
            return res.status(404).json({ success: false, message: 'Gift not found' });
        }

        if (title !== undefined) gift.title = title.trim();
        if (description !== undefined) gift.description = description.trim();
        
        const coinVal = coinReward !== undefined ? Number(coinReward) : (coin !== undefined ? Number(coin) : undefined);
        if (coinVal !== undefined) {
            gift.coinCost = coinVal;
            gift.coinReward = coinVal;
        }

        if (status !== undefined) gift.status = Number(status);
        if (req.file) gift.image = req.file.path;

        // Handling duration / expiry update
        if (extendHours) {
            const addMs = Number(extendHours) * 60 * 60 * 1000;
            const currentExp = gift.expiresAt && new Date(gift.expiresAt) > new Date() ? new Date(gift.expiresAt) : new Date();
            gift.expiresAt = new Date(currentExp.getTime() + addMs);
        } else if (expiresAt) {
            gift.expiresAt = new Date(expiresAt);
        } else if (durationHours) {
            const hours = Number(durationHours);
            gift.durationHours = hours;
            gift.expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
        }

        await gift.save();

        const obj = gift.toObject();
        const now = new Date();
        const exp = obj.expiresAt ? new Date(obj.expiresAt) : null;
        const isExpired = exp ? now > exp : false;

        return res.json({
            success: true,
            gift: {
                ...obj,
                coin: obj.coinReward,
                isExpired,
                claimedCount: (obj.claimedBy || []).length,
            }
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Extend a gift duration
// @route   POST /api/admin/gifts/:id/extend
const extendGift = async (req, res, next) => {
    try {
        const { hours = 24 } = req.body;
        const gift = await Gift.findById(req.params.id);
        if (!gift) {
            return res.status(404).json({ success: false, message: 'Gift not found' });
        }

        const addMs = Number(hours) * 60 * 60 * 1000;
        const baseTime = (gift.expiresAt && new Date(gift.expiresAt) > new Date()) 
            ? new Date(gift.expiresAt).getTime() 
            : Date.now();

        gift.expiresAt = new Date(baseTime + addMs);
        gift.status = 1; // re-activate if it was expired
        await gift.save();

        return res.json({
            success: true,
            message: `Gift extended by ${hours} hours`,
            gift: {
                ...gift.toObject(),
                coin: gift.coinReward,
                isExpired: false,
                claimedCount: (gift.claimedBy || []).length
            }
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Delete a gift
// @route   DELETE /api/admin/gifts/:id
const deleteGift = async (req, res, next) => {
    try {
        const gift = await Gift.findByIdAndDelete(req.params.id);
        if (!gift) {
            return res.status(404).json({ success: false, message: 'Gift not found' });
        }
        return res.json({ success: true, message: 'Gift deleted successfully' });
    } catch (err) {
        next(err);
    }
};

module.exports = { getGifts, createGift, updateGift, extendGift, deleteGift };
