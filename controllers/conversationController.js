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

        const seenUsers = new Set();
        const formatted = [];

        for (const c of conversations) {
            const otherUser = c.participants.find((p) => p && p._id.toString() !== req.user._id.toString());
            if (!otherUser) continue;

            const otherUserId = otherUser._id.toString();
            if (seenUsers.has(otherUserId)) continue;
            seenUsers.add(otherUserId);

            formatted.push({
                conversationId: c._id,
                matchId: c.match,
                user: otherUser,
                lastMessage: c.lastMessage,
                lastMessageAt: c.lastMessageAt,
                updatedAt: c.updatedAt,
            });
        }

        return res.json({ success: true, conversations: formatted });
    } catch (err) {
        next(err);
    }
};

// Helper function to find or create a conversation flexible with ObjectId or chat_<targetUserId>
const findOrCreateConversation = async (paramId, currentUserId) => {
    // 1. Try finding by conversation _id directly if valid ObjectId
    if (paramId && paramId.match(/^[0-9a-fA-F]{24}$/)) {
        const conv = await Conversation.findOne({ _id: paramId, participants: currentUserId });
        if (conv) return conv;
    }

    // 2. Try target user ID (strip "chat_" if present)
    const targetUserId = (paramId || '').replace(/^chat_/, '');
    if (targetUserId && targetUserId.match(/^[0-9a-fA-F]{24}$/)) {
        let conv = await Conversation.findOne({
            participants: { $all: [currentUserId, targetUserId] }
        });
        if (!conv) {
            conv = await Conversation.create({
                participants: [currentUserId, targetUserId]
            });
        }
        return conv;
    }

    return null;
};

// @desc    Get messages for a conversation (paginated)
// @route   GET /api/conversations/:id/messages?page=1&limit=30
// @access  Private
const getMessages = async (req, res, next) => {
    try {
        const conversation = await findOrCreateConversation(req.params.id, req.user._id);

        if (!conversation) return res.status(404).json({ success: false, message: 'Conversation not found' });

        const convId = conversation._id;
        const { page = 1, limit = 30 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const messages = await Message.find({ conversation: convId })
            .populate('sender', 'name photos')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        // Filter out duplicate identical messages created within a 3-second window
        const uniqueMessages = [];
        const seenMsgKeys = new Set();

        for (const m of messages) {
            const senderId = m.sender?._id ? m.sender._id.toString() : (m.sender?.toString() || '');
            const timeKey = Math.floor(new Date(m.createdAt).getTime() / 3000);
            const key = `${senderId}_${m.text}_${timeKey}`;

            if (seenMsgKeys.has(key)) continue;
            seenMsgKeys.add(key);
            uniqueMessages.push(m);
        }

        // Mark unread messages as read
        await Message.updateMany(
            { conversation: convId, readBy: { $ne: req.user._id } },
            { $addToSet: { readBy: req.user._id } }
        );

        return res.json({ success: true, conversationId: convId, messages: uniqueMessages.reverse(), page: parseInt(page) });
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

        const conversation = await findOrCreateConversation(req.params.id, req.user._id);

        if (!conversation) return res.status(404).json({ success: false, message: 'Conversation not found' });

        const message = await Message.create({
            conversation: conversation._id,
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

// @desc    Delete a message
// @route   DELETE /api/conversations/:id/messages/:messageId
// @access  Private
const deleteMessage = async (req, res, next) => {
    try {
        const { id: conversationId, messageId } = req.params;
        const currentUserId = req.user._id;

        // Find the message
        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({ success: false, message: 'Message not found' });
        }

        // Check if the user is the sender of the message
        if (message.sender.toString() !== currentUserId.toString()) {
            return res.status(403).json({ success: false, message: 'Unauthorized to delete this message' });
        }

        // Delete the message
        await Message.deleteOne({ _id: messageId });

        // Update the conversation's last message if this was the last message
        const conversation = await Conversation.findById(conversationId);
        if (conversation && conversation.lastMessage && conversation.lastMessage.toString() === messageId) {
            // Find the new last message
            const newLastMessage = await Message.findOne({ conversation: conversationId })
                .sort({ createdAt: -1 });

            if (newLastMessage) {
                conversation.lastMessage = newLastMessage._id;
                conversation.lastMessageAt = newLastMessage.createdAt;
            } else {
                conversation.lastMessage = null;
                conversation.lastMessageAt = null;
            }
            await conversation.save();
        }

        // Emit the socket event to delete the message on the frontend for all room members
        const io = req.app.get('io');
        if (io) {
            io.to(conversationId).emit('message_deleted', { conversationId, messageId });
        }

        return res.json({ success: true, message: 'Message deleted successfully' });
    } catch (err) {
        next(err);
    }
};

module.exports = { getConversations, getMessages, sendMessage, deleteMessage };
