const User = require('../../models/User');
const Interest = require('../../models/Interest');
const Language = require('../../models/Language');
const Religion = require('../../models/Religion');
const RelationGoal = require('../../models/RelationGoal');
const FAQ = require('../../models/FAQ');
const Plan = require('../../models/Plan');
const Page = require('../../models/Page');
const Gift = require('../../models/Gift');
const Package = require('../../models/Package');
const Payment = require('../../models/Payment');

// @desc    Get dashboard stats
// @route   GET /api/admin/stats
const getStats = async (req, res, next) => {
    try {
        const [
            interests,
            languages,
            religions,
            relationGoals,
            faqs,
            plans,
            usersCount,
            pages,
            gifts,
            packages,
            maleUsers,
            femaleUsers,
            fakeUsers,
            payments,
        ] = await Promise.all([
            Interest.countDocuments(),
            Language.countDocuments(),
            Religion.countDocuments(),
            RelationGoal.countDocuments(),
            FAQ.countDocuments(),
            Plan.countDocuments(),
            User.countDocuments({ isDeleted: false }),
            Page.countDocuments(),
            Gift.countDocuments(),
            Package.countDocuments(),
            User.countDocuments({ gender: { $regex: /^(man|male)$/i }, isDeleted: false }),
            User.countDocuments({ gender: { $regex: /^(woman|female)$/i }, isDeleted: false }),
            User.countDocuments({ isFake: true, isDeleted: false }),
            Payment.find({ status: 'completed' }).select('amount').lean(),
        ]);

        const earnings = payments.reduce((acc, curr) => acc + (curr.amount || 0), 0);

        return res.json({
            success: true,
            stats: {
                interests,
                languages,
                religions,
                relationGoals,
                faqs,
                plans,
                users: usersCount,
                pages,
                gifts,
                packages,
                maleUsers,
                femaleUsers,
                fakeUsers,
                earnings,
            }
        });
    } catch (err) {
        next(err);
    }
};

module.exports = { getStats };
