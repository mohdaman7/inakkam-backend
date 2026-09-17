const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const Match = require('../models/Match');
const User = require('../models/User');
const audioSecurityService = require('../services/audioSecurityService');

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
// ─────────────────────────────────────────────
// EnableX room replacement / recovery
// ─────────────────────────────────────────────

socket.on(
    'enablex_room_recreated',
    ({
        targetUserId,
        conversationId,
        roomId,
        callType
    }) => {

        const targetUidStr = String(targetUserId);

        if (
            !targetUidStr ||
            !roomId
        ) {
            console.error(
                '[Socket] Invalid enablex_room_recreated payload'
            );

            return;
        }

        const payload = {
            conversationId,
            roomId,
            callType,
            recreatedBy: String(userId)
        };

        // Tell the other participant to use the new room.
        io.to(
            `user_${targetUidStr}`
        ).emit(
            'enablex_room_recreated',
            payload
        );

        console.log(
            `🔄 [EnableX] Room recreated: ${roomId}`
        );

        console.log(
            `   From: ${userId}`
        );

        console.log(
            `   To: ${targetUidStr}`
        );
    }
);
        // Send message via socket
        socket.on('send_message', async ({ conversationId, text, tempId }) => {
            try {
                if (!text || !text.trim()) return;

                const senderUser = await User.findById(userId).lean();
                const isSenderStaff = senderUser && (senderUser.isEliteAgent || senderUser.isStaff || senderUser.role === 'staff' || senderUser.role === 'admin');
                const isCustomer = !isSenderStaff;

                // Validate 20-character limit for customer messages
                if (isCustomer && text.trim().length > 20) {
                    socket.emit('message_error', { tempId, message: 'Customer messages cannot exceed 20 characters.' });
                    return;
                }

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
                    const targetUser = await User.findById(targetUserId).lean();
                    const isTargetAgent = targetUser && (targetUser.isEliteAgent || targetUser.isStaff || targetUser.role === 'staff' || targetUser.role === 'admin');

                    if (isSenderStaff || isTargetAgent) {
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

                const messagePayload = {
                    ...populated,
                    tempId,
                    conversationId: conversation._id.toString(),
                    conversation: conversation._id.toString(),
                };

                // Broadcast to conversation room
                io.to(conversation._id.toString()).emit('new_message', messagePayload);
                if (conversationId && conversationId !== conversation._id.toString()) {
                    io.to(conversationId).emit('new_message', messagePayload);
                }

                // ALWAYS broadcast to both participants' direct user rooms for instant on-the-spot delivery!
                if (conversation.participants && Array.isArray(conversation.participants)) {
                    conversation.participants.forEach((participantId) => {
                        const pidStr = participantId ? participantId.toString() : '';
                        if (pidStr) {
                            io.to(`user_${pidStr}`).emit('new_message', messagePayload);
                        }
                    });
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

        // In-call text chat & GIF relay
        socket.on('webrtc_chat', async ({ id, targetUserId, roomId, conversationId, message, type, gifUrl, senderName }) => {
            try {
                let chatText = message;
                let containsPhone = false;

                const actualGifUrl = gifUrl || (type === 'gif' ? message : null) || (typeof message === 'string' && (message.includes('giphy.com') || message.includes('.gif')) ? message : null);
                const actualType = actualGifUrl ? 'gif' : (type || 'text');

                if (actualType !== 'gif' && chatText && typeof chatText === 'string') {
                    let senderUser = null;
                    if (userId && String(userId).match(/^[0-9a-fA-F]{24}$/)) {
                        try {
                            senderUser = await User.findById(userId).lean();
                        } catch (dbErr) {
                            console.warn('[webrtc_chat] senderUser lookup error:', dbErr);
                        }
                    }
                    const isSenderStaff = senderUser && (senderUser.isEliteAgent || senderUser.isStaff || senderUser.role === 'staff' || senderUser.role === 'admin');

                    // Check if message contains 7+ digits or phone number pattern
                    const phonePattern = /(?:(?:\+|0{0,2})91[\s.-]?)?[6-9]\d{9}/;
                    const digitSeqPattern = /(?:\d[\s.,\-_/()]*){7,}/;
                    if (phonePattern.test(chatText) || digitSeqPattern.test(chatText)) {
                        containsPhone = true;
                        chatText = '[🛡️ Phone number removed for privacy]';
                    }

                    if (!isSenderStaff && chatText && chatText.length > 20 && !containsPhone) {
                        chatText = chatText.slice(0, 20);
                    }
                }

                // Extract string target UID safely even if an object or nested object is provided
                let targetUidStr = null;
                if (targetUserId) {
                    if (typeof targetUserId === 'object') {
                        targetUidStr = String(targetUserId._id || targetUserId.id || targetUserId.userId || '');
                    } else {
                        targetUidStr = String(targetUserId);
                    }
                }
                if (targetUidStr === '[object Object]' || targetUidStr === 'null' || targetUidStr === 'undefined') {
                    targetUidStr = null;
                }

                const msgId = id || `webrtc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
                const payload = {
                    id: msgId,
                    socketId: socket.id,
                    senderId: String(userId),
                    senderName: senderName || 'Call Partner',
                    message: actualType === 'gif' ? (chatText || actualGifUrl) : chatText,
                    type: actualType,
                    gifUrl: actualGifUrl,
                    roomId: roomId ? String(roomId) : '',
                    conversationId: conversationId ? String(conversationId) : '',
                    timestamp: Date.now()
                };

                console.log(`💬 [Socket webrtc_chat] from ${userId} (${payload.type}) -> target:${targetUidStr} room:${roomId} conv:${conversationId}`);

                // 1. Emit to target user's personal room
                if (targetUidStr && targetUidStr.length > 0) {
                    io.to(`user_${targetUidStr}`).emit('webrtc_chat', payload);
                }

                // 2. Also emit to the call session room so both sides receive it
                if (roomId) {
                    socket.to(String(roomId)).emit('webrtc_chat', payload);
                }

                // 3. Also emit to conversation room if different from roomId
                if (conversationId && String(conversationId) !== String(roomId)) {
                    socket.to(String(conversationId)).emit('webrtc_chat', payload);
                }

                // 4. Persist message to DB if conversationId is a valid Mongo ObjectId
                if (conversationId && String(conversationId).match(/^[0-9a-fA-F]{24}$/) && !containsPhone && (chatText || actualGifUrl)) {
                    try {
                        const savedMsg = await Message.create({
                            conversation: conversationId,
                            sender: userId,
                            text: actualType === 'gif' ? (actualGifUrl || chatText) : chatText,
                            readBy: [userId],
                        });
                        await Conversation.findByIdAndUpdate(conversationId, {
                            lastMessage: savedMsg._id,
                            lastMessageAt: savedMsg.createdAt,
                        }).exec();
                        console.log(`💾 [webrtc_chat] Persisted in-call message to conversation ${conversationId}`);
                    } catch (dbSaveErr) {
                        console.warn('[webrtc_chat] Non-fatal DB save error:', dbSaveErr.message);
                    }
                }

                // If a phone number was attempted, trigger audio security block
                if (containsPhone) {
                    const blockPayload = {
                        conversationId: conversationId || roomId,
                        roomId: String(roomId || ''),
                        reason: 'phone_number_in_chat',
                        blockedUserId: String(userId),
                    };
                    if (targetUidStr && targetUidStr !== 'null') {
                        io.to(`user_${targetUidStr}`).emit('call_audio_security_block', blockPayload);
                    }
                    socket.emit('call_audio_security_block', blockPayload);
                }
            } catch (err) {
                console.error('[webrtc_chat error]', err);
            }
        });

        // ─── Call Audio Security (Phone Number Mention / Share Defense) ──
        socket.on('call_audio_security_block', ({ conversationId, targetUserId, roomId, reason }) => {
            try {
                const targetUidStr = targetUserId ? String(targetUserId) : null;
                const payload = {
                    conversationId,
                    roomId: String(roomId || conversationId || ''),
                    reason: reason || 'phone_number_detected',
                    blockedUserId: String(userId)
                };

                if (targetUidStr && targetUidStr !== 'null' && targetUidStr !== '[object Object]') {
                    io.to(`user_${targetUidStr}`).emit('call_audio_security_block', payload);
                }

                if (roomId) {
                    socket.to(String(roomId)).emit('call_audio_security_block', payload);
                }

                console.log(`🛡️ [Security] call_audio_security_block relayed: user=${userId} to target=${targetUidStr} (room=${roomId})`);
            } catch (err) {
                console.error('[Socket call_audio_security_block error]', err);
            }
        });

        socket.on('call_audio_security_unblock', ({ conversationId, targetUserId, roomId }) => {
            try {
                const targetUidStr = targetUserId ? String(targetUserId) : null;
                const payload = {
                    conversationId,
                    roomId: String(roomId || conversationId || ''),
                    unblockedUserId: String(userId)
                };

                if (targetUidStr && targetUidStr !== 'null' && targetUidStr !== '[object Object]') {
                    io.to(`user_${targetUidStr}`).emit('call_audio_security_unblock', payload);
                }

                if (roomId) {
                    socket.to(String(roomId)).emit('call_audio_security_unblock', payload);
                }

                console.log(`🛡️ [Security] call_audio_security_unblock relayed: user=${userId}`);
            } catch (err) {
                console.error('[Socket call_audio_security_unblock error]', err);
            }
        });

        // ─── Screen & Video Recording Protection Relay ─────────
        socket.on('screen_recording_attempt', ({ conversationId, targetUserId, roomId }) => {
            try {
                const targetUidStr = targetUserId ? String(targetUserId) : null;
                const payload = {
                    conversationId,
                    roomId: String(roomId || conversationId || ''),
                    violatorId: String(userId)
                };

                if (targetUidStr && targetUidStr !== 'null' && targetUidStr !== '[object Object]') {
                    io.to(`user_${targetUidStr}`).emit('screen_recording_attempt', payload);
                }

                if (roomId) {
                    socket.to(String(roomId)).emit('screen_recording_attempt', payload);
                }

                console.log(`🛡️ [Security] screen_recording_attempt relayed from user=${userId} to target=${targetUidStr}`);
            } catch (err) {
                console.error('[Socket screen_recording_attempt error]', err);
            }
        });

        // ─── Real-Time In-Call Audio Stream Chunk for AI Speech Security ──
        socket.on('call_audio_chunk', async ({ audio, roomId, conversationId, targetUserId }) => {
            try {
                if (!audio) return;
                await audioSecurityService.processAudioChunk(audio, {
                    roomId,
                    conversationId,
                    userId,
                    targetUserId,
                    io,
                    socket,
                });
            } catch (chunkErr) {
                console.warn('[call_audio_chunk error]', chunkErr);
            }
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
