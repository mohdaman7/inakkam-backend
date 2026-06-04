const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

// @desc    Get all conversations for current user
// @route   GET /api/conversations
// @access  Private
const getConversations = async (req, res, next) => {
    try {
        const conversations = await Conversation.find({
            participants: req.user._id,
        })
            .populate('participants', 'name photos isOnline lastActive verified')
            .populate('lastMessage', 'text createdAt sender')
            .sort({ lastMessageAt: -1 })
            .lean();

        const formatted = conversations.map((c) => {
            const otherUser = c.participants.find((p) => p._id.toString() !== req.user._id.toString());
            return {
                conversationId: c._id,
                matchId: c.match,
                user: otherUser,
                lastMessage: c.lastMessage,
                lastMessageAt: c.lastMessageAt,
                updatedAt: c.updatedAt,
            };
        });

        return res.json({ success: true, conversations: formatted });
    } catch (err) {
        next(err);
    }
};

// @desc    Get messages for a conversation (paginated)
// @route   GET /api/conversations/:id/messages?page=1&limit=30
// @access  Private
const getMessages = async (req, res, next) => {
    try {
        const conversation = await Conversation.findOne({
            _id: req.params.id,
            participants: req.user._id,
        });

        if (!conversation) return res.status(404).json({ success: false, message: 'Conversation not found' });

        const { page = 1, limit = 30 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const messages = await Message.find({ conversation: req.params.id })
            .populate('sender', 'name photos')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        // Mark unread messages as read
        await Message.updateMany(
            { conversation: req.params.id, readBy: { $ne: req.user._id } },
            { $addToSet: { readBy: req.user._id } }
        );

        return res.json({ success: true, messages: messages.reverse(), page: parseInt(page) });
    } catch (err) {
        next(err);
    }
};

// @desc    Send a message (REST fallback — prefer Socket.io)
// @route   POST /api/conversations/:id/messages
// @access  Private
const sendMessage = async (req, res, next) => {
    try {
        const { text } = req.body;
        if (!text || !text.trim()) return res.status(400).json({ success: false, message: 'Message text is required' });

        const conversation = await Conversation.findOne({
            _id: req.params.id,
            participants: req.user._id,
        });

        if (!conversation) return res.status(404).json({ success: false, message: 'Conversation not found' });

        const message = await Message.create({
            conversation: req.params.id,
            sender: req.user._id,
            text: text.trim(),
            readBy: [req.user._id],
        });

        conversation.lastMessage = message._id;
        conversation.lastMessageAt = message.createdAt;
        await conversation.save();

        const populated = await message.populate('sender', 'name photos');
        return res.status(201).json({ success: true, message: populated });
    } catch (err) {
        next(err);
    }
};

module.exports = { getConversations, getMessages, sendMessage };
