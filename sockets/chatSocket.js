const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const User = require('../models/User');

// Map of userId -> socketId for presence tracking
const onlineUsers = new Map();

const chatSocket = (io) => {
    io.on('connection', (socket) => {
        const userId = socket.handshake.auth?.userId;
        if (!userId) {
            socket.disconnect(true);
            return;
        }

        // Register user as online
        onlineUsers.set(userId, socket.id);
        User.findByIdAndUpdate(userId, { isOnline: true, lastActive: Date.now() })
            .exec()
            .catch((err) => console.error('[Socket connect] Failed to update user status', err));
        io.emit('user_status', { userId, isOnline: true });

        console.log(`🟢 Socket connected: user=${userId} socket=${socket.id}`);

        // Join a conversation room
        socket.on('join_room', (conversationId) => {
            socket.join(conversationId);
        });

        // Send message via socket
        socket.on('send_message', async ({ conversationId, text, tempId }) => {
            try {
                if (!text || !text.trim()) return;

                // Verify user is a participant in the conversation
                const conversation = await Conversation.findOne({
                    _id: conversationId,
                    participants: userId,
                });
                if (!conversation) return;

                const message = await Message.create({
                    conversation: conversationId,
                    sender: userId,
                    text: text.trim(),
                    readBy: [userId],
                });

                conversation.lastMessage = message._id;
                conversation.lastMessageAt = message.createdAt;
                await conversation.save();

                const populated = await Message.findById(message._id).populate('sender', 'name photos').lean();

                // Broadcast to everyone in the room (including sender for confirmation)
                io.to(conversationId).emit('new_message', { ...populated, tempId });
            } catch (err) {
                socket.emit('message_error', { tempId, message: 'Failed to send message' });
                console.error('[Socket send_message]', err);
            }
        });

        // Typing indicators
        socket.on('typing', ({ conversationId }) => {
            socket.to(conversationId).emit('user_typing', { userId, conversationId });
        });

        socket.on('stop_typing', ({ conversationId }) => {
            socket.to(conversationId).emit('user_stop_typing', { userId, conversationId });
        });

        // Message read receipt
        socket.on('message_read', async ({ conversationId }) => {
            try {
                await Message.updateMany(
                    { conversation: conversationId, sender: { $ne: userId }, readBy: { $ne: userId } },
                    { $addToSet: { readBy: userId } }
                );
                socket.to(conversationId).emit('messages_read', { conversationId, readBy: userId });
            } catch (err) {
                console.error('[Socket message_read]', err);
            }
        });

        // Call signaling
        socket.on('call_user', ({ conversationId, targetUserId, roomId, callerName, callerPhoto, callType }) => {
            const targetSocketId = onlineUsers.get(targetUserId);
            if (targetSocketId) {
                io.to(targetSocketId).emit('incoming_call', {
                    conversationId,
                    callerId: userId,
                    callerName,
                    callerPhoto,
                    roomId,
                    callType
                });
                console.log(`📞 Socket: call_user from ${userId} to ${targetUserId} (room=${roomId})`);
            } else {
                socket.emit('call_error', { message: 'User is offline' });
            }
        });

        socket.on('accept_call', ({ conversationId, callerId }) => {
            const callerSocketId = onlineUsers.get(callerId);
            if (callerSocketId) {
                io.to(callerSocketId).emit('call_accepted', { conversationId, receiverId: userId });
                console.log(`📞 Socket: accept_call from ${userId} to caller ${callerId}`);
            }
        });

        socket.on('reject_call', ({ conversationId, callerId }) => {
            const callerSocketId = onlineUsers.get(callerId);
            if (callerSocketId) {
                io.to(callerSocketId).emit('call_rejected', { conversationId, receiverId: userId });
                console.log(`📞 Socket: reject_call from ${userId} to caller ${callerId}`);
            }
        });

        socket.on('end_call', ({ conversationId, targetUserId }) => {
            const targetSocketId = onlineUsers.get(targetUserId);
            if (targetSocketId) {
                io.to(targetSocketId).emit('call_ended', { conversationId });
                console.log(`📞 Socket: end_call from ${userId} to ${targetUserId}`);
            }
        });

        // Disconnect / offline
        socket.on('disconnect', () => {
            onlineUsers.delete(userId);
            User.findByIdAndUpdate(userId, { isOnline: false, lastActive: Date.now() })
                .exec()
                .catch((err) => console.error('[Socket disconnect] Failed to update user status', err));
            io.emit('user_status', { userId, isOnline: false });
            console.log(`🔴 Socket disconnected: user=${userId}`);
        });
    });
};

module.exports = chatSocket;
