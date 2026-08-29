const getAuthHeader = () => {
    const appId = process.env.ENABLEX_APP_ID;
    const appKey = process.env.ENABLEX_APP_KEY;
    if (!appId || !appKey || appKey === 'your_enablex_app_key_here') {
        return null;
    }
    return `Basic ${Buffer.from(`${appId}:${appKey}`).toString('base64')}`;
};

// @desc    Create an EnableX video room (p2p mode for 1-on-1 calls)
// @route   POST /api/enablex/create-room
// @access  Private
const createRoom = async (req, res, next) => {
    try {
        const { name } = req.body;
        const authHeader = getAuthHeader();

        if (!authHeader) {
            console.warn('⚠️ EnableX credentials not configured. Returning mock Room ID.');
            return res.status(200).json({
                success: true,
                message: 'Mock room created (No Credentials)',
                room: {
                    room_id: `mock_room_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
                }
            });
        }

        const roomBody = {
            name: name || `Inakkam Call ${Date.now()}`,
            owner_ref: req.user._id.toString(),
            settings: {
                description: 'Inakkam real-time call session',
                // 'p2p' mode is for 1-on-1 calls — works on trial accounts
                // 'group' mode requires special account configuration
                mode: 'p2p',
                scheduled: false,
                duration: 60,
                moderators: '1',
                participants: '2',
                billing_code: 'inakkam',
                media: {
                    audio_muted: false,
                    video_muted: false
                }
            },
            sip: false
        };

        console.log('[EnableX Create Room Request]', JSON.stringify(roomBody));

        const response = await fetch('https://api.enablex.io/video/v1/rooms', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader
            },
            body: JSON.stringify(roomBody)
        });

        const data = await response.json();
        console.log('[EnableX Create Room Response]', JSON.stringify(data));

        if (!response.ok || data.result !== 0) {
            console.error('[EnableX Create Room Error]', data);
            return res.status(response.ok ? 500 : response.status).json({
                success: false,
                message: data.desc || data.error || data.message || 'Failed to create EnableX room',
                enablexError: data
            });
        }

        return res.json({ success: true, room: data.room });
    } catch (err) {
        console.error('[EnableX Create Room Exception]', err);
        next(err);
    }
};

// @desc    Generate EnableX participant/moderator token for a room
// @route   POST /api/enablex/get-token
// @access  Private
const getToken = async (req, res, next) => {
    try {
        const { roomId, role } = req.body;
        if (!roomId) {
            return res.status(400).json({ success: false, message: 'Room ID is required' });
        }

        const authHeader = getAuthHeader();

        if (!authHeader || roomId.startsWith('mock_')) {
            console.warn('⚠️ EnableX credentials not configured or mock roomId. Returning mock Token.');
            return res.status(200).json({
                success: true,
                message: 'Mock token generated (No Credentials)',
                token: `mock_token_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
            });
        }

        const tokenBody = {
            name: req.user.name || 'Inakkam User',
            // 'moderator' = call initiator (can record, mute others)
            // 'participant' = call receiver
            role: role === 'moderator' ? 'moderator' : 'participant',
            user_ref: req.user._id.toString(),
            data: JSON.stringify({ userId: req.user._id.toString() })
        };

        console.log(`[EnableX Get Token Request] roomId=${roomId}, role=${tokenBody.role}`);

        const response = await fetch(`https://api.enablex.io/video/v1/rooms/${roomId}/tokens`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader
            },
            body: JSON.stringify(tokenBody)
        });

        const data = await response.json();
        console.log('[EnableX Get Token Response]', JSON.stringify(data));

        if (!response.ok || data.result !== 0) {
            console.error('[EnableX Get Token Error]', data);
            return res.status(response.ok ? 500 : response.status).json({
                success: false,
                message: data.desc || data.error || data.message || 'Failed to generate EnableX token',
                enablexError: data
            });
        }

        // EnableX returns the token string in data.token
        const tokenString = data.token;
        if (!tokenString) {
            console.error('[EnableX Get Token] No token in response:', data);
            return res.status(500).json({
                success: false,
                message: 'EnableX did not return a token',
                enablexResponse: data
            });
        }

        return res.json({ success: true, token: tokenString });
    } catch (err) {
        console.error('[EnableX Get Token Exception]', err);
        next(err);
    }
};

module.exports = { createRoom, getToken };
