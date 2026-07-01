const Gift = require('../../models/Gift');

// @desc    Get all gifts
// @route   GET /api/admin/gifts
const getGifts = async (req, res, next) => {
    try {
        const gifts = await Gift.find().sort({ sortOrder: 1, createdAt: -1 }).lean();
        // Map coinCost to coin for the dashboard
        const formatted = gifts.map(g => ({
            ...g,
            coin: g.coinCost,
        }));
        return res.json({ success: true, gifts: formatted });
    } catch (err) {
        next(err);
    }
};

// @desc    Create gift
// @route   POST /api/admin/gifts
const createGift = async (req, res, next) => {
    try {
        const { coin, status } = req.body;
        const coinVal = coin !== undefined ? Number(coin) : 0;

        const imageUrl = req.file ? req.file.path : '';

        const gift = await Gift.create({
            title: `Gift of ${coinVal} Coins`,
            coinCost: coinVal,
            status: status !== undefined ? Number(status) : 1,
            image: imageUrl,
        });

        return res.status(201).json({
            success: true,
            gift: {
                ...gift.toObject(),
                coin: gift.coinCost,
            }
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Update gift
// @route   PUT /api/admin/gifts/:id
const updateGift = async (req, res, next) => {
    try {
        const { coin, status } = req.body;
        const gift = await Gift.findById(req.params.id);
        if (!gift) {
            return res.status(404).json({ success: false, message: 'Gift not found' });
        }

        if (coin !== undefined) {
            gift.coinCost = Number(coin);
            gift.title = `Gift of ${coin} Coins`;
        }
        if (status !== undefined) gift.status = Number(status);
        if (req.file) gift.image = req.file.path;

        await gift.save();

        return res.json({
            success: true,
            gift: {
                ...gift.toObject(),
                coin: gift.coinCost,
            }
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Delete gift
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

module.exports = { getGifts, createGift, updateGift, deleteGift };
