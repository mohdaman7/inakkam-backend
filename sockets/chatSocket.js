const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const Match = require('../models/Match');
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
        const uidStr = String(userId);
        onlineUsers.set(uidStr, socket.id);
        User.findByIdAndUpdate(userId, { isOnline: true, lastActive: Date.now() })
            .exec()
            .catch((err) => console.error('[Socket connect] Failed to update user status', err));
        io.emit('user_status', { userId: uidStr, isOnline: true });

        console.log(`🟢 Socket connected: user=${uidStr} socket=${socket.id}`);

        // Join a conversation room
        socket.on('join_room', (conversationId) => {
            socket.join(conversationId);
        });

        // Send message via socket
        socket.on('send_message', async ({ conversationId, text, tempId }) => {
            try {
                if (!text || !text.trim()) return;

                let conversation = await Conversation.findOne({
                    _id: conversationId,
                    participants: userId,
                });

                let targetUserId = null;

                if (conversation) {
                    const other = conversation.participants.find(p => p.toString() !== userId.toString());
                    targetUserId = other ? other.toString() : null;
                } else {
                    targetUserId = (conversationId || '').replace(/^chat_/, '');
                }

                if (!targetUserId || !targetUserId.match(/^[0-9a-fA-F]{24}$/)) {
                    socket.emit('message_error', { tempId, message: 'Invalid recipient' });
                    return;
                }

                // Enforce Mutual Match Requirement (with Agent auto-matching)
                let activeMatch = await Match.findOne({
                    users: { $all: [userId, targetUserId] },
                    isActive: true
                });

                if (!activeMatch) {
                    const [senderUser, targetUser] = await Promise.all([
                        User.findById(userId).lean(),
                        User.findById(targetUserId).lean()
                    ]);
                    const isSenderAgent = senderUser && (senderUser.isEliteAgent || senderUser.isStaff || senderUser.role === 'staff');
                    const isTargetAgent = targetUser && (targetUser.isEliteAgent || targetUser.isStaff || targetUser.role === 'staff');

                    if (isSenderAgent || isTargetAgent) {
                        activeMatch = await Match.create({ users: [userId, targetUserId] });
                        await User.updateMany({ _id: { $in: [userId, targetUserId] } }, { $inc: { matchesCount: 1 } });
                    }
                }

                if (!activeMatch) {
                    socket.emit('message_error', { tempId, message: 'Messaging is restricted to mutual matches only.' });
                    return;
                }

                if (!conversation) {
                    conversation = await Conversation.findOne({
                        participants: { $all: [userId, targetUserId] }
                    });
                    if (!conversation) {
                        conversation = await Conversation.create({
                            participants: [userId, targetUserId],
                            match: activeMatch._id
                        });
                    }
                }

                const message = await Message.create({
                    conversation: conversation._id,
                    sender: userId,
                    text: text.trim(),
                    readBy: [userId],
                });

                conversation.lastMessage = message._id;
                conversation.lastMessageAt = message.createdAt;
                await conversation.save();

                const populated = await Message.findById(message._id).populate('sender', 'name photos').lean();

                // Broadcast to everyone in the room (including sender for confirmation)
                io.to(conversation._id.toString()).emit('new_message', { ...populated, tempId });
                if (conversationId && conversationId !== conversation._id.toString()) {
                    io.to(conversationId).emit('new_message', { ...populated, tempId });
                }
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
        socket.on('call_user', async ({ conversationId, targetUserId, roomId, callerName, callerPhoto, callType }) => {
            try {
                if (!targetUserId || !targetUserId.match(/^[0-9a-fA-F]{24}$/)) {
                    socket.emit('call_error', { message: 'Invalid call recipient' });
                    return;
                }

                // Enforce Mutual Match Requirement for Calling (with Agent auto-matching)
                let activeMatch = await Match.findOne({
                    users: { $all: [userId, targetUserId] },
                    isActive: true
                });

                if (!activeMatch) {
                    const [callerUser, targetUser] = await Promise.all([
                        User.findById(userId).lean(),
                        User.findById(targetUserId).lean()
                    ]);
                    const isCallerAgent = callerUser && (callerUser.isEliteAgent || callerUser.isStaff || callerUser.role === 'staff');
                    const isTargetAgent = targetUser && (targetUser.isEliteAgent || targetUser.isStaff || targetUser.role === 'staff');

                    if (isCallerAgent || isTargetAgent) {
                        activeMatch = await Match.create({ users: [userId, targetUserId] });
                        await User.updateMany({ _id: { $in: [userId, targetUserId] } }, { $inc: { matchesCount: 1 } });
                    }
                }

                if (!activeMatch) {
                    socket.emit('call_error', { message: 'Calling is restricted to mutual matches only.' });
                    return;
                }

                const targetSocketId = onlineUsers.get(String(targetUserId));
                if (targetSocketId) {
                    io.to(targetSocketId).emit('incoming_call', {
                        conversationId,
                        callerId: String(userId),
                        callerName,
                        callerPhoto,
                        roomId,
                        callType
                    });
                    console.log(`📞 Socket: call_user from ${userId} to ${targetUserId} (room=${roomId})`);
                } else {
                    socket.emit('call_error', { message: 'User is currently offline' });
                }
            } catch (err) {
                socket.emit('call_error', { message: 'Failed to initiate call' });
                console.error('[Socket call_user]', err);
            }
        });

        socket.on('accept_call', ({ conversationId, callerId }) => {
            const callerSocketId = onlineUsers.get(String(callerId));
            if (callerSocketId) {
                io.to(callerSocketId).emit('call_accepted', { conversationId, receiverId: String(userId) });
                console.log(`📞 Socket: accept_call from ${userId} to caller ${callerId}`);
            }
        });

        socket.on('reject_call', ({ conversationId, callerId }) => {
            const callerSocketId = onlineUsers.get(String(callerId));
            if (callerSocketId) {
                io.to(callerSocketId).emit('call_rejected', { conversationId, receiverId: String(userId) });
                console.log(`📞 Socket: reject_call from ${userId} to caller ${callerId}`);
            }
        });

        socket.on('end_call', ({ conversationId, targetUserId }) => {
            const targetSocketId = onlineUsers.get(String(targetUserId));
            if (targetSocketId) {
                io.to(targetSocketId).emit('call_ended', { conversationId });
                console.log(`📞 Socket: end_call from ${userId} to ${targetUserId}`);
            }
        });

        // WebRTC Direct P2P Fallback Signaling
        socket.on('webrtc_ready', ({ targetUserId }) => {
            const targetSocketId = onlineUsers.get(String(targetUserId));
            if (targetSocketId) {
                io.to(targetSocketId).emit('webrtc_ready', { senderId: String(userId) });
                console.log(`📞 Socket: webrtc_ready from ${userId} to ${targetUserId}`);
            }
        });

        socket.on('webrtc_offer', ({ targetUserId, offer }) => {
            const targetSocketId = onlineUsers.get(String(targetUserId));
            if (targetSocketId) {
                io.to(targetSocketId).emit('webrtc_offer', { senderId: String(userId), offer });
                console.log(`📞 Socket: webrtc_offer from ${userId} to ${targetUserId}`);
            }
        });

        socket.on('webrtc_answer', ({ targetUserId, answer }) => {
            const targetSocketId = onlineUsers.get(String(targetUserId));
            if (targetSocketId) {
                io.to(targetSocketId).emit('webrtc_answer', { senderId: String(userId), answer });
                console.log(`📞 Socket: webrtc_answer from ${userId} to ${targetUserId}`);
            }
        });

        socket.on('webrtc_ice_candidate', ({ targetUserId, candidate }) => {
            const targetSocketId = onlineUsers.get(String(targetUserId));
            if (targetSocketId) {
                io.to(targetSocketId).emit('webrtc_ice_candidate', { senderId: String(userId), candidate });
            }
        });

        // In-call text chat relay
        socket.on('webrtc_chat', ({ targetUserId, message }) => {
            const targetSocketId = onlineUsers.get(String(targetUserId));
            if (targetSocketId) {
                io.to(targetSocketId).emit('webrtc_chat', { senderId: String(userId), message });
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
