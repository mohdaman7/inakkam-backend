const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const Match = require('../models/Match');
const User = require('../models/User');
const audioSecurityService = require('../services/audioSecurityService');

// Map of userId -> socketId for presence tracking
const onlineUsers = new Map();

// Active call sessions for 30s timeout & auto-forwarding
const activeCallSessions = new Map();

// Helper to handle missed calls & auto-forwarding
async function handleCallTimeoutOrDecline(io, sessionKey, agentId, reason = 'timeout') {
    const session = activeCallSessions.get(sessionKey);
    if (!session) return;

    if (session.timer) {
        clearTimeout(session.timer);
        session.timer = null;
    }

    try {
        const agentUidStr = String(agentId);
        const agent = await User.findById(agentUidStr);
        if (agent) {
            const isAgent = agent.isEliteAgent || agent.isStaff || agent.role === 'staff';
            if (isAgent) {
                agent.consecutiveMissedCalls = (agent.consecutiveMissedCalls || 0) + 1;
                console.log(`⚠️ Agent ${agent.name} missed call (${reason}). Consecutive: ${agent.consecutiveMissedCalls}/5`);

                if (agent.consecutiveMissedCalls >= 5) {
                    agent.isActive = false;
                    agent.isBlocked = true;
                    agent.blockedReason = '5 consecutive missed calls';
                    await agent.save();

                    console.log(`🚫 Agent ${agent.name} (${agent._id}) auto-blocked due to 5 missed calls.`);
                    io.to(`user_${agentUidStr}`).emit('account_blocked', {
                        message: 'Your host account has been suspended due to 5 consecutive missed calls. You will not receive calls or appear on the website until reactivated by an Admin.'
                    });
                } else {
                    await agent.save();
                }
            }
        }

        // Notify agent's screen to dismiss the incoming popup
        io.to(`user_${agentUidStr}`).emit('call_ended', { conversationId: session.conversationId, reason: 'Call timed out' });

        // Query next available online Elite Agent who has not been attempted yet
        const candidateAgents = await User.find({
            _id: { $nin: Array.from(session.attemptedAgents) },
            $or: [{ isEliteAgent: true }, { isStaff: true }, { role: 'staff' }],
            isDeleted: { $ne: true },
            isBlocked: { $ne: true },
            isActive: { $ne: false }
        }).select('name photos isOnline').lean();

        // Find connected / online agent
        let nextAgent = candidateAgents.find(a => onlineUsers.has(String(a._id)));
        if (!nextAgent && candidateAgents.length > 0) {
            // If none in onlineUsers map, pick first eligible online user
            nextAgent = candidateAgents.find(a => a.isOnline) || candidateAgents[0];
        }

        if (nextAgent) {
            const nextAgentIdStr = String(nextAgent._id);
            session.attemptedAgents.add(nextAgentIdStr);
            session.currentTargetAgentId = nextAgentIdStr;

            console.log(`🔀 Forwarding call from ${session.callerName} to next agent ${nextAgent.name} (${nextAgentIdStr})`);

            // Notify caller about forwarding
            io.to(`user_${session.callerId}`).emit('call_forwarding', {
                message: `Host unavailable. Routing your call to ${nextAgent.name || 'next available host'}...`,
                nextAgentName: nextAgent.name,
                nextAgentPhoto: nextAgent.photos?.[0]?.url || ''
            });

            // Emit incoming call to next agent with 30s timeout
            const callPayload = {
                conversationId: session.conversationId,
                callerId: session.callerId,
                callerName: session.callerName,
                callerPhoto: session.callerPhoto,
                roomId: session.roomId,
                callType: session.callType,
                timeout: 30
            };
            io.to(`user_${nextAgentIdStr}`).emit('incoming_call', callPayload);

            // Restart 30-second timer for the next agent
            session.timer = setTimeout(() => {
                handleCallTimeoutOrDecline(io, sessionKey, nextAgentIdStr, 'timeout');
            }, 30000);
        } else {
            console.log(`❌ No more available agents for call from ${session.callerName}. Ending call.`);
            io.to(`user_${session.callerId}`).emit('call_ended', {
                conversationId: session.conversationId,
                message: 'All hosts are currently busy or unavailable. Please try again later.'
            });
            activeCallSessions.delete(sessionKey);
            if (session.roomId) activeCallSessions.delete(session.roomId);
        }
    } catch (err) {
        console.error('[handleCallTimeoutOrDecline Error]', err);
        activeCallSessions.delete(sessionKey);
    }
}

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

                // Helper to recognize GIF and media URLs so they are not rejected by the 20-char text limit
                const isGifUrl = (str) => {
                    if (!str || typeof str !== 'string') return false;
                    const s = str.trim();
                    return (s.startsWith('http://') || s.startsWith('https://')) &&
                        (s.includes('giphy') || s.includes('tenor') || s.includes('.gif') || s.includes('.webp') || s.includes('/media/'));
                };

                // Validate 20-character limit for customer messages (GIFs & media URLs are exempt)
                if (isCustomer && text.trim().length > 20 && !isGifUrl(text.trim())) {
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
                    expireAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
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

        // ─── Call Signaling (30s Timeout, Auto-Forwarding & Attendance Tracking) ─
        socket.on('call_user', async ({ conversationId, targetUserId, roomId, callerName, callerPhoto, callType }) => {
            try {
                const targetUidStr = String(targetUserId);
                if (!targetUidStr || !targetUidStr.match(/^[0-9a-fA-F]{24}$/)) {
                    socket.emit('call_error', { message: 'Invalid call recipient' });
                    return;
                }

                // Check recipient availability and blocked status
                const [callerUser, targetUser] = await Promise.all([
                    User.findById(userId).lean(),
                    User.findById(targetUserId).lean()
                ]);

                if (!targetUser || targetUser.isDeleted || targetUser.isBlocked || targetUser.isActive === false) {
                    socket.emit('call_error', { message: 'This host is currently unavailable or inactive.' });
                    return;
                }

                // Enforce Mutual Match Requirement for Calling (with Agent auto-matching)
                let activeMatch = await Match.findOne({
                    users: { $all: [userId, targetUserId] },
                    isActive: true
                });

                const isCallerAgent = callerUser && (callerUser.isEliteAgent || callerUser.isStaff || callerUser.role === 'staff');
                const isTargetAgent = targetUser && (targetUser.isEliteAgent || targetUser.isStaff || targetUser.role === 'staff');

                if (!activeMatch) {
                    if (isCallerAgent || isTargetAgent) {
                        activeMatch = await Match.create({ users: [userId, targetUserId] });
                        await User.updateMany({ _id: { $in: [userId, targetUserId] } }, { $inc: { matchesCount: 1 } });
                    }
                }

                if (!activeMatch) {
                    socket.emit('call_error', { message: 'Calling is restricted to mutual matches only.' });
                    return;
                }

                const sessionKey = `${userId}_${roomId}`;
                
                // Clear any previous session for this caller
                if (activeCallSessions.has(sessionKey)) {
                    const prev = activeCallSessions.get(sessionKey);
                    if (prev.timer) clearTimeout(prev.timer);
                    activeCallSessions.delete(sessionKey);
                }

                const callSession = {
                    sessionKey,
                    roomId,
                    conversationId,
                    callerId: String(userId),
                    callerName: callerName || callerUser?.name || 'Inakkam User',
                    callerPhoto: callerPhoto || callerUser?.photos?.[0]?.url || '',
                    callType: callType || 'video',
                    currentTargetAgentId: targetUidStr,
                    attemptedAgents: new Set([targetUidStr]),
                    timer: null
                };

                // Start 30-Second Call Timeout Timer
                callSession.timer = setTimeout(() => {
                    handleCallTimeoutOrDecline(io, sessionKey, targetUidStr, 'timeout');
                }, 30000);

                activeCallSessions.set(sessionKey, callSession);
                if (roomId) activeCallSessions.set(roomId, callSession);

                const callPayload = {
                    conversationId,
                    callerId: String(userId),
                    callerName: callSession.callerName,
                    callerPhoto: callSession.callerPhoto,
                    roomId,
                    callType: callSession.callType,
                    timeout: 30
                };

                io.to(`user_${targetUidStr}`).emit('incoming_call', callPayload);
                console.log(`📞 Socket: incoming_call (30s timer) emitted to user_${targetUidStr} (room=${roomId})`);
            } catch (err) {
                socket.emit('call_error', { message: 'Failed to initiate call' });
                console.error('[Socket call_user]', err);
            }
        });

        socket.on('accept_call', async ({ conversationId, callerId }) => {
            try {
                const callerUidStr = String(callerId);
                const acceptPayload = { conversationId, receiverId: String(userId) };

                // Find and clear any active call timer
                for (const [key, s] of activeCallSessions.entries()) {
                    if (String(s.currentTargetAgentId) === String(userId) || String(s.callerId) === callerUidStr) {
                        if (s.timer) clearTimeout(s.timer);
                        activeCallSessions.delete(key);
                    }
                }

                // Reset consecutive missed calls for answering agent
                await User.findByIdAndUpdate(userId, { consecutiveMissedCalls: 0 }).exec().catch(() => {});

                io.to(`user_${callerUidStr}`).emit('call_accepted', acceptPayload);
                console.log(`📞 Socket: call_accepted emitted to user_${callerUidStr} - Missed calls reset for user ${userId}`);
            } catch (err) {
                console.error('[Socket accept_call]', err);
            }
        });

        socket.on('reject_call', async ({ conversationId, callerId }) => {
            try {
                const callerUidStr = String(callerId);
                
                // Find matching session
                let matchedSessionKey = null;
                for (const [key, s] of activeCallSessions.entries()) {
                    if (String(s.currentTargetAgentId) === String(userId) || String(s.callerId) === callerUidStr) {
                        matchedSessionKey = key;
                        break;
                    }
                }

                if (matchedSessionKey) {
                    console.log(`📞 Socket: Call rejected by ${userId}. Auto-forwarding to next host...`);
                    handleCallTimeoutOrDecline(io, matchedSessionKey, String(userId), 'declined');
                } else {
                    const rejectPayload = { conversationId, receiverId: String(userId) };
                    io.to(`user_${callerUidStr}`).emit('call_rejected', rejectPayload);
                    console.log(`📞 Socket: call_rejected emitted to user_${callerUidStr}`);
                }
            } catch (err) {
                console.error('[Socket reject_call]', err);
            }
        });

        socket.on('end_call', ({ conversationId, targetUserId }) => {
            // Clean up any active session
            for (const [key, s] of activeCallSessions.entries()) {
                if (String(s.callerId) === String(userId) || String(s.currentTargetAgentId) === String(userId)) {
                    if (s.timer) clearTimeout(s.timer);
                    activeCallSessions.delete(key);
                }
            }

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

                const isMediaOrGif = (str) => {
                    if (!str || typeof str !== 'string') return false;
                    const s = str.trim();
                    return (s.startsWith('http://') || s.startsWith('https://')) &&
                        (s.includes('giphy') || s.includes('tenor') || s.includes('.gif') || s.includes('.webp') || s.includes('/media/'));
                };

                const extractGiphyId = (url) => {
                    if (!url || typeof url !== 'string') return null;
                    const s = url.trim();
                    const iMatch = s.match(/i\.giphy\.com\/(?:media\/)?([a-zA-Z0-9_-]+?)(?:\.gif|\/|$|\?)/i);
                    if (iMatch && iMatch[1] && iMatch[1] !== 'media' && iMatch[1] !== 'v1' && iMatch[1].length > 3) return iMatch[1];
                    const mediaV1Match = s.match(/media[0-9]?\.giphy\.com\/media\/v1\.[^/]+\/([a-zA-Z0-9_-]+)\//i);
                    if (mediaV1Match && mediaV1Match[1] && mediaV1Match[1] !== 'v1') return mediaV1Match[1];
                    const mediaDirectMatch = s.match(/media[0-9]?\.giphy\.com\/media\/([a-zA-Z0-9_-]+)\//i);
                    if (mediaDirectMatch && mediaDirectMatch[1] && !mediaDirectMatch[1].startsWith('v1.') && mediaDirectMatch[1] !== 'v1') return mediaDirectMatch[1];
                    const webMatch = s.match(/giphy\.com\/(?:gifs|embed)\/(?:.*-)?([a-zA-Z0-9_-]+)(?:\/|$|\?)/i);
                    if (webMatch && webMatch[1]) return webMatch[1];
                    return null;
                };

                const cleanBackendGifUrl = (url) => {
                    if (!url || typeof url !== 'string') return null;
                    const trimmed = url.trim();
                    const gid = extractGiphyId(trimmed);
                    if (gid && gid !== 'v1') return `https://i.giphy.com/${gid}.gif`;
                    if (trimmed.includes('v1.gif') || trimmed.endsWith('/v1')) return 'https://i.giphy.com/BPJmthQ3YRwD6QqcVD.gif';
                    return trimmed;
                };

                const candidateGifUrl = gifUrl || (type === 'gif' ? message : null) || (isMediaOrGif(message) ? message : null) || (typeof message === 'string' && (message.includes('giphy') || message.includes('tenor') || message.includes('.gif')) ? message : null);
                const actualGifUrl = candidateGifUrl ? cleanBackendGifUrl(candidateGifUrl) : null;
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

                    if (!isSenderStaff && chatText && chatText.length > 20 && !containsPhone && !isMediaOrGif(chatText)) {
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
                            expireAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
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
