const getAuthHeader = () => {
    const appId = process.env.ENABLEX_APP_ID;
    const appKey = process.env.ENABLEX_APP_KEY;

    if (!appId || !appKey || appKey === 'your_enablex_app_key_here') {
        return null;
    }

    return `Basic ${Buffer.from(`${appId}:${appKey}`).toString('base64')}`;
};

const RATE_LIMIT_COOLDOWN_MS = 15 * 1000;
let rateLimitedUntil = 0;

const isInCooldown = () => Date.now() < rateLimitedUntil;

const startCooldown = (retryAfterHeader) => {
    const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : null;
    rateLimitedUntil = Date.now() + (retryAfterMs && !Number.isNaN(retryAfterMs) ? retryAfterMs : RATE_LIMIT_COOLDOWN_MS);
};

const rateLimitedResponse = (res, retryAfterHeader) => {
    const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : Math.ceil(RATE_LIMIT_COOLDOWN_MS / 1000);
    res.set('Retry-After', String(retryAfterSeconds));
    return res.status(429).json({
        success: false,
        rateLimited: true,
        message: 'Video service is temporarily rate-limited. Please wait a moment and try again.',
        retryAfterSeconds
    });
};

const createRoom = async (req, res, next) => {
    try {
        if (isInCooldown()) {
            console.warn('[EnableX] create-room short-circuited (rate-limit cooldown)');
            return rateLimitedResponse(res);
        }

        const { name } = req.body;
        const authHeader = getAuthHeader();

        if (!authHeader) {
            console.error('[EnableX] Credentials not configured');
            return res.status(500).json({ success: false, message: 'EnableX credentials are not configured' });
        }

        const roomBody = {
            name: name || `Inakkam Call ${Date.now()}`,
            owner_ref: req.user._id.toString(),
            settings: {
                description: 'Inakkam real-time call session',
                mode: 'p2p',
                scheduled: false,
                adhoc: true,
                duration: 60,
                moderators: '1',
                participants: '1',
                quality: 'HD',
                auto_recording: false,
                screen_share: true
            },
            sip: { enabled: false }
        };

        console.log('[EnableX] Creating room:', JSON.stringify(roomBody));

        const response = await fetch('https://api.enablex.io/video/v2/rooms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
            body: JSON.stringify(roomBody)
        });

        if (response.status === 429) {
            const retryAfterHeader = response.headers.get('Retry-After');
            console.error('[EnableX] create-room 429. Retry-After:', retryAfterHeader);
            startCooldown(retryAfterHeader);
            return rateLimitedResponse(res, retryAfterHeader);
        }

        const data = await response.json();
        console.log('[EnableX] Create room response:', JSON.stringify(data));

        if (!response.ok || data.result !== 0) {
            console.error('[EnableX] Create room failed:', data);
            return res.status(response.ok ? 500 : response.status).json({
                success: false,
                message: data.desc || data.error || data.message || 'Failed to create EnableX room',
                enablexError: data
            });
        }

        if (!data.room) {
            console.error('[EnableX] Room missing from response:', data);
            return res.status(500).json({ success: false, message: 'EnableX did not return room information', enablexResponse: data });
        }

        const newRoomId = data.room.room_id || data.room.roomId || data.room.id;

        if (!newRoomId) {
            console.error('[EnableX] Could not determine room ID:', data.room);
            return res.status(500).json({ success: false, message: 'EnableX room ID was not returned', room: data.room });
        }

        console.log(`[EnableX] Room created: ${newRoomId}`);
        return res.json({ success: true, room: data.room, roomId: newRoomId });

    } catch (err) {
        console.error('[EnableX] Create room exception:', err);
        next(err);
    }
};

const getToken = async (req, res, next) => {
    try {
        if (isInCooldown()) {
            console.warn('[EnableX] get-token short-circuited (rate-limit cooldown)');
            return rateLimitedResponse(res);
        }

        const { roomId, role, name: bodyName, userRef: bodyUserRef } = req.body;

        if (!roomId) {
            return res.status(400).json({ success: false, message: 'Room ID is required' });
        }

        if (roomId.startsWith('mock_')) {
            console.warn('[EnableX] Mock roomId rejected:', roomId);
            return res.status(400).json({ success: false, message: 'Invalid EnableX room. Real EnableX room required.' });
        }

        const authHeader = getAuthHeader();

        if (!authHeader) {
            console.error('[EnableX] Credentials not configured');
            return res.status(500).json({ success: false, message: 'EnableX credentials are not configured' });
        }

        const resolvedName = req.user?.name || bodyName || 'Inakkam User';
        const resolvedUserRef = (req.user?._id || req.user?.id)?.toString() || bodyUserRef || 'unknown';
        const resolvedRole = role === 'moderator' ? 'moderator' : 'participant';

        const tokenBody = {
            name: resolvedName,
            role: resolvedRole,
            user_ref: resolvedUserRef,
            ttl: 86400,
            data: { userId: resolvedUserRef }
        };

        console.log(`[EnableX] Generating token: room=${roomId} role=${resolvedRole} user=${resolvedUserRef} name="${resolvedName}"`);

        const response = await fetch(`https://api.enablex.io/video/v2/rooms/${roomId}/tokens`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
            body: JSON.stringify(tokenBody)
        });

        if (response.status === 429) {
            const retryAfterHeader = response.headers.get('Retry-After');
            console.error('[EnableX] get-token 429. Retry-After:', retryAfterHeader);
            startCooldown(retryAfterHeader);
            return rateLimitedResponse(res, retryAfterHeader);
        }

        const data = await response.json();
        console.log('[EnableX] Token response:', JSON.stringify(data));

        if (!response.ok || data.result !== 0) {
            console.error('[EnableX] Token generation failed:', data);
            return res.status(response.ok ? 500 : response.status).json({
                success: false,
                message: data.desc || data.error || data.message || 'Failed to generate EnableX token',
                enablexError: data
            });
        }

        const tokenString = data.token;

        if (!tokenString) {
            console.error('[EnableX] No token returned:', data);
            return res.status(500).json({ success: false, message: 'EnableX did not return a token', enablexResponse: data });
        }

        console.log(`[EnableX] Token generated: room=${roomId} user=${resolvedUserRef} role=${resolvedRole}`);
        return res.json({ success: true, token: tokenString, roomId });

    } catch (err) {
        console.error('[EnableX] Get token exception:', err);
        next(err);
    }
};

module.exports = { createRoom, getToken };