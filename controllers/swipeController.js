const Swipe = require('../models/Swipe');
const Match = require('../models/Match');
const Conversation = require('../models/Conversation');
const Notification = require('../models/Notification');
const User = require('../models/User');

// @desc    Record a swipe action
// @route   POST /api/swipe
// @access  Private
const recordSwipe = async (req, res, next) => {
    try {
        const { swipedUserId, action } = req.body;
        if (!swipedUserId || !['left', 'right', 'superlike'].includes(action)) {
            return res.status(400).json({ success: false, message: 'swipedUserId and valid action required' });
        }

        const me = req.user;
        if (swipedUserId === me._id.toString()) {
            return res.status(400).json({ success: false, message: 'Cannot swipe yourself' });
        }

        const targetUser = await User.findById(swipedUserId);
        if (!targetUser || targetUser.isDeleted) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Upsert: update if exists (undo+reswipe scenario), else create
        await Swipe.findOneAndUpdate(
            { swiper: me._id, swiped: swipedUserId },
            { action },
            { upsert: true, new: true }
        );

        let isMatch = false;
        let matchData = null;

        if (action === 'right' || action === 'superlike') {
            // Check if the other person already swiped right on us
            const theirSwipe = await Swipe.findOne({ swiper: swipedUserId, swiped: me._id, action: { $in: ['right', 'superlike'] } });

            if (theirSwipe) {
                // It's a match! Check if match already exists
                const existingMatch = await Match.findOne({ users: { $all: [me._id, swipedUserId] } });

                if (!existingMatch) {
                    const match = await Match.create({ users: [me._id, swipedUserId] });
                    const conversation = await Conversation.create({
                        participants: [me._id, swipedUserId],
                        match: match._id,
                    });

                    // Update match counts
                    await User.updateMany({ _id: { $in: [me._id, swipedUserId] } }, { $inc: { matchesCount: 1 } });

                    // Send notifications to both users
                    await Notification.create([
                        {
                            recipient: me._id,
                            type: 'match',
                            fromUser: swipedUserId,
                            text: `You matched with ${targetUser.name}! Send a message to start the spark.`,
                            meta: { matchId: match._id, conversationId: conversation._id },
                        },
                        {
                            recipient: swipedUserId,
                            type: 'match',
                            fromUser: me._id,
                            text: `You matched with ${me.name}! Send a message to start the spark.`,
                            meta: { matchId: match._id, conversationId: conversation._id },
                        },
                    ]);

                    isMatch = true;
                    matchData = { matchId: match._id, conversationId: conversation._id };
                } else {
                    isMatch = true;
                }
            } else {
                // Notify them that someone likes them (hidden for free users)
                await Notification.create({
                    recipient: swipedUserId,
                    type: action === 'superlike' ? 'superlike' : 'like',
                    fromUser: me._id,
                    text: action === 'superlike'
                        ? `Someone super-liked you! Upgrade to Premium to see who.`
                        : `Someone liked your profile! Upgrade to Premium to see who.`,
                });

                await User.findByIdAndUpdate(swipedUserId, { $inc: { likesCount: 1 } });
            }
        }

        return res.json({ success: true, action, isMatch, match: matchData });
    } catch (err) {
        next(err);
    }
};

// @desc    Undo the last swipe (premium only)
// @route   DELETE /api/swipe/undo
// @access  Private
const undoSwipe = async (req, res, next) => {
    try {
        const lastSwipe = await Swipe.findOne({ swiper: req.user._id }).sort({ createdAt: -1 });
        if (!lastSwipe) return res.status(404).json({ success: false, message: 'No swipe to undo' });

        await lastSwipe.deleteOne();
        return res.json({ success: true, message: 'Swipe undone' });
    } catch (err) {
        next(err);
    }
};

module.exports = { recordSwipe, undoSwipe };
