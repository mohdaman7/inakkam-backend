const Story = require('../models/Story');
const Match = require('../models/Match');
const { cloudinary } = require('../config/cloudinary');

// @desc    Get stories from matches + own stories
// @route   GET /api/stories
// @access  Private
const getStories = async (req, res, next) => {
    try {
        // Get matched user IDs
        const matches = await Match.find({ users: req.user._id, isActive: true }).lean();
        const matchedIds = matches.flatMap((m) =>
            m.users.filter((u) => u.toString() !== req.user._id.toString())
        );

        // Include current user's own stories
        const relevantIds = [req.user._id, ...matchedIds];

        const stories = await Story.find({
            user: { $in: relevantIds },
            expiresAt: { $gt: new Date() },
        })
            .populate('user', 'name photos isOnline verified')
            .sort({ createdAt: -1 })
            .lean();

        // Group by user
        const grouped = {};
        stories.forEach((story) => {
            const uid = story.user._id.toString();
            if (!grouped[uid]) {
                grouped[uid] = {
                    userId: uid,
                    userName: story.user.name,
                    profileImage: story.user.photos?.[0]?.url || '',
                    isOnline: story.user.isOnline,
                    verified: story.user.verified,
                    stories: [],
                    hasUnseen: false,
                };
            }
            const seen = story.viewers.some((v) => v.toString() === req.user._id.toString());
            if (!seen) grouped[uid].hasUnseen = true;
            grouped[uid].stories.push({ ...story, seen });
        });

        return res.json({ success: true, stories: Object.values(grouped) });
    } catch (err) {
        next(err);
    }
};

// @desc    Create a story
// @route   POST /api/stories
// @access  Private (file upload by multer)
const createStory = async (req, res, next) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'No media file uploaded' });

        const isVideo = req.file.mimetype.startsWith('video/');
        const story = await Story.create({
            user: req.user._id,
            mediaUrl: req.file.path,
            mediaPublicId: req.file.filename,
            mediaType: isVideo ? 'video' : 'image',
        });

        return res.status(201).json({ success: true, story });
    } catch (err) {
        next(err);
    }
};

// @desc    Mark a story as viewed
// @route   POST /api/stories/:id/view
// @access  Private
const viewStory = async (req, res, next) => {
    try {
        await Story.findByIdAndUpdate(req.params.id, {
            $addToSet: { viewers: req.user._id },
        });
        return res.json({ success: true });
    } catch (err) {
        next(err);
    }
};

module.exports = { getStories, createStory, viewStory };
