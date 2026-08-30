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

        // Register user as online & join individual user room
        const uidStr = String(userId);
        onlineUsers.set(uidStr, socket.id);
        socket.join(`user_${uidStr}`);

        User.findByIdAndUpdate(userId, { isOnline: true, lastActive: Date.now() })
            .exec()
            .catch((err) => console.error('[Socket connect] Failed to update user status', err));
        io.emit('user_status', { userId: uidStr, isOnline: true });

        console.log(`🟢 Socket connected: user=${uidStr} (room: user_${uidStr}) socket=${socket.id}`);

        // Join a conversation room
        socket.on('join_room', (conversationId) => {
            if (conversationId) {
                socket.join(String(conversationId));
            }
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

        // ─── Call Signaling ─────────────────────────────────────
        socket.on('call_user', async ({ conversationId, targetUserId, roomId, callerName, callerPhoto, callType }) => {
            try {
                const targetUidStr = String(targetUserId);
                if (!targetUidStr || !targetUidStr.match(/^[0-9a-fA-F]{24}$/)) {
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

                const callPayload = {
                    conversationId,
                    callerId: String(userId),
                    callerName,
                    callerPhoto,
                    roomId,
                    callType
                };

                io.to(`user_${targetUidStr}`).emit('incoming_call', callPayload);
                console.log(`📞 Socket: incoming_call emitted to user_${targetUidStr} (room=${roomId})`);
            } catch (err) {
                socket.emit('call_error', { message: 'Failed to initiate call' });
                console.error('[Socket call_user]', err);
            }
        });

        socket.on('accept_call', ({ conversationId, callerId }) => {
            const callerUidStr = String(callerId);
            const acceptPayload = { conversationId, receiverId: String(userId) };
            io.to(`user_${callerUidStr}`).emit('call_accepted', acceptPayload);
            console.log(`📞 Socket: call_accepted emitted to user_${callerUidStr}`);
        });

        socket.on('reject_call', ({ conversationId, callerId }) => {
            const callerUidStr = String(callerId);
            const rejectPayload = { conversationId, receiverId: String(userId) };
            io.to(`user_${callerUidStr}`).emit('call_rejected', rejectPayload);
            console.log(`📞 Socket: call_rejected emitted to user_${callerUidStr}`);
        });

        socket.on('end_call', ({ conversationId, targetUserId }) => {
            const targetUidStr = String(targetUserId);
            const endPayload = { conversationId };
            io.to(`user_${targetUidStr}`).emit('call_ended', endPayload);
            console.log(`📞 Socket: call_ended emitted to user_${targetUidStr}`);
        });

        // ─── WebRTC Direct P2P Signaling ────────────────────────
        socket.on('webrtc_caller_ready', ({ targetUserId }) => {
            const targetUidStr = String(targetUserId);
            const payload = { senderId: String(userId) };
            io.to(`user_${targetUidStr}`).emit('webrtc_caller_ready', payload);
            console.log(`📞 [WebRTC] webrtc_caller_ready from ${userId} to user_${targetUidStr}`);
        });

        socket.on('webrtc_ready', ({ targetUserId }) => {
            const targetUidStr = String(targetUserId);
            const payload = { senderId: String(userId) };
            io.to(`user_${targetUidStr}`).emit('webrtc_ready', payload);
            console.log(`📞 [WebRTC] webrtc_ready from ${userId} to user_${targetUidStr}`);
        });

        socket.on('webrtc_offer', ({ targetUserId, offer }) => {
            const targetUidStr = String(targetUserId);
            const payload = { senderId: String(userId), offer };
            console.log('🔥 WEBRTC OFFER SERVER', {
                from: String(userId),
                to: targetUidStr,
                hasOffer: !!offer
            });
            io.to(`user_${targetUidStr}`).emit('webrtc_offer', payload);
        });

        socket.on('webrtc_answer', ({ targetUserId, answer }) => {
            const targetUidStr = String(targetUserId);
            const payload = { senderId: String(userId), answer };
            console.log('🔥 WEBRTC ANSWER SERVER', {
                from: String(userId),
                to: targetUidStr,
                hasAnswer: !!answer
            });
            io.to(`user_${targetUidStr}`).emit('webrtc_answer', payload);
        });

        socket.on('webrtc_ice_candidate', ({ targetUserId, candidate }) => {
            const targetUidStr = String(targetUserId);
            const payload = { senderId: String(userId), candidate };
            io.to(`user_${targetUidStr}`).emit('webrtc_ice_candidate', payload);
        });

        // In-call text chat relay
        socket.on('webrtc_chat', ({ targetUserId, message }) => {
            const targetUidStr = String(targetUserId);
            const payload = { senderId: String(userId), message };
            io.to(`user_${targetUidStr}`).emit('webrtc_chat', payload);
        });

        // Disconnect / offline
        socket.on('disconnect', () => {
            onlineUsers.delete(userId);
            User.findByIdAndUpdate(userId, { isOnline: false, lastActive: Date.now() })
                .exec()
                .catch((err) => console.error('[Socket disconnect] Failed to update user status', err));
            io.emit('user_status', { userId: uidStr, isOnline: false });
            console.log(`🔴 Socket disconnected: user=${userId}`);
        });
    });
};

module.exports = chatSocket;
