const User = require('../models/User');
const Swipe = require('../models/Swipe');

// Compute a simple match score based on shared interests
const computeMatchScore = (userA, userB) => {
    const setA = new Set((userA.interests || []).map(i => i.toLowerCase()));
    const setB = new Set((userB.interests || []).map(i => i.toLowerCase()));
    const shared = [...setA].filter(i => setB.has(i)).length;
    const total = new Set([...setA, ...setB]).size;
    if (total === 0) return 50;
    return Math.min(99, Math.round(50 + (shared / total) * 50));
};

// @desc    Get potential matches (paginated, already-swiped excluded)
// @route   GET /api/discover?page=1&limit=20
// @access  Private
const getDiscover = async (req, res, next) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const me = req.user;

        // Get IDs the current user has already swiped
        const swiped = await Swipe.find({ swiper: me._id }).select('swiped').lean();
        const swipedIds = swiped.map(s => s.swiped);

        // Exclude: self, already-swiped, blocked
        const excludedIds = [me._id, ...swipedIds, ...(me.blockedUsers || [])];

        const filter = {
            _id: { $nin: excludedIds },
            isDeleted: false,
            isOnboarded: true,
        };

        // Filter by gender preference
        if (me.interestedIn && me.interestedIn.length > 0) {
            filter.gender = { $in: me.interestedIn };
        }

        // Filter by age range preference
        if (me.ageRange) {
            filter.age = { $gte: me.ageRange.min || 18, $lte: me.ageRange.max || 99 };
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const users = await User.find(filter)
            .select('name age bio work education photos interests prompts zodiac height exercise relationship religion languages verified badges location lastActive isOnline')
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        const enriched = users.map(u => ({
            ...u,
            matchPercentage: computeMatchScore(me, u),
            distance: Math.floor(Math.random() * 20) + 1 + ' miles away', // placeholder until geo is set up
        }));

        return res.json({ success: true, users: enriched, page: parseInt(page) });
    } catch (err) {
        next(err);
    }
};

module.exports = { getDiscover };
