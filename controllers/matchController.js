const Match = require('../models/Match');
const Conversation = require('../models/Conversation');
const User = require('../models/User');

// @desc    Get all matches for current user
// @route   GET /api/matches
// @access  Private
const getMatches = async (req, res, next) => {
    try {
        const matches = await Match.find({
            users: req.user._id,
            isActive: true,
        })
            .populate('users', 'name age photos isOnline lastActive verified badges isEliteAgent isStaff role')
            .sort({ createdAt: -1 })
            .lean();

        const isMeAgent = Boolean(req.user && (req.user.isEliteAgent || req.user.isStaff || req.user.role === 'staff' || req.user.role === 'admin'));

        const formatted = matches
            .map((m) => {
                const otherUser = m.users.find((u) => u && u._id.toString() !== req.user._id.toString());
                if (!otherUser) return null;
                const isOtherAgent = Boolean(otherUser.isEliteAgent || otherUser.isStaff || otherUser.role === 'staff' || otherUser.role === 'admin');
                if (isMeAgent && isOtherAgent) return null; // Agent cannot match with another agent
                if (!isMeAgent && !isOtherAgent) return null; // Customer cannot match with another customer
                return {
                    matchId: m._id,
                    matchedAt: m.createdAt,
                    user: otherUser,
                };
            })
            .filter(Boolean);

        return res.json({ success: true, matches: formatted });
    } catch (err) {
        next(err);
    }
};

// @desc    Unmatch a user
// @route   DELETE /api/matches/:matchId
// @access  Private
const unmatch = async (req, res, next) => {
    try {
        const match = await Match.findOne({
            _id: req.params.matchId,
            users: req.user._id,
        });

        if (!match) return res.status(404).json({ success: false, message: 'Match not found' });

        match.isActive = false;
        await match.save();

        // Also soft-delete the conversation
        await Conversation.findOneAndUpdate({ match: match._id }, { isActive: false });

        return res.json({ success: true, message: 'Unmatched successfully' });
    } catch (err) {
        next(err);
    }
};

module.exports = { getMatches, unmatch };
