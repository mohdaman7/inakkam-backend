const User = require('../models/User');

const PLANS = [
    {
        id: 'boost',
        name: 'Inakkam Boost',
        description: 'Get noticed faster with priority likes and profile spotlights.',
        price: 14.99,
        currency: 'USD',
        period: 'month',
        features: [
            '1 Free Profile Spotlight per week',
            '5 Super Swipes per day',
            'See who viewed your profile (last 24h)',
            'Unlimited swipe undo/rewind',
            'Custom profile badges',
        ],
    },
    {
        id: 'premium',
        name: 'Inakkam Premium',
        description: 'The ultimate dating experience. Unlocked potential.',
        price: 29.99,
        currency: 'USD',
        period: 'month',
        isPopular: true,
        features: [
            'Unlimited swipes',
            'Unlimited Profile Spotlights',
            'See everyone who likes you instantly',
            'Advanced matching filters (Zodiac, height, etc.)',
            'Incognito mode',
            '1 Golden Super-Like per week',
            'Priority support',
        ],
    },
    {
        id: 'lifetime',
        name: 'Inakkam Lifetime',
        description: 'A lifetime of premium matching and infinite connections.',
        price: 119.99,
        currency: 'USD',
        period: 'one-time',
        features: [
            'All Premium features forever',
            'Exclusive Golden profile border',
            'VIP badge status',
            'First access to new features',
            'No recurring fees',
        ],
    },
];

// @desc    Get membership plans
// @route   GET /api/membership/plans
// @access  Public
const getPlans = async (req, res) => {
    return res.json({ success: true, plans: PLANS });
};

// @desc    Subscribe to a plan (mock — integrate Razorpay/Stripe in prod)
// @route   POST /api/membership/subscribe
// @access  Private
const subscribe = async (req, res, next) => {
    try {
        const { planId } = req.body;
        const validPlans = ['boost', 'premium', 'lifetime'];
        if (!validPlans.includes(planId)) {
            return res.status(400).json({ success: false, message: 'Invalid plan ID' });
        }

        const now = new Date();
        const endDate = planId === 'lifetime' ? new Date('2099-12-31') : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        const user = await User.findByIdAndUpdate(
            req.user._id,
            {
                $set: {
                    membership: { plan: planId, startDate: now, endDate },
                    badges: planId === 'lifetime' ? ['VIP', 'Premium Member'] : planId === 'premium' ? ['Premium Member'] : ['Boost'],
                },
            },
            { new: true }
        );

        return res.json({ success: true, membership: user.membership, badges: user.badges });
    } catch (err) {
        next(err);
    }
};

// @desc    Get current membership status
// @route   GET /api/membership/status
// @access  Private
const getMembershipStatus = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id).select('membership badges');
        return res.json({ success: true, membership: user.membership, badges: user.badges });
    } catch (err) {
        next(err);
    }
};

module.exports = { getPlans, subscribe, getMembershipStatus };
