const getAuthHeader = () => {
    const appId = process.env.ENABLEX_APP_ID;
    const appKey = process.env.ENABLEX_APP_KEY;
    if (!appId || !appKey || appKey === 'your_enablex_app_key_here') {
        return null;
    }
    return `Basic ${Buffer.from(`${appId}:${appKey}`).toString('base64')}`;
};

// @desc    Create an EnableX video room
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

        const response = await fetch('https://api.enablex.io/video/v1/rooms', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader
            },
            body: JSON.stringify({
                name: name || `Inakkam Call ${Date.now()}`,
                owner_ref: req.user._id.toString(),
                settings: {
                    description: 'Inakkam real-time call session',
                    mode: 'manyw',
                    scheduled: false,
                    adhoc: true,
                    duration: 60,
                    moderators: 1,
                    participants: 2,
                    billing_code: 'inakkam'
                },
                sip: false
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('[EnableX Create Room Error]', data);
            return res.status(response.status).json({
                success: false,
                message: data.message || 'Failed to create EnableX room'
            });
        }

        return res.json({ success: true, room: data.room });
    } catch (err) {
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

        const response = await fetch(`https://api.enablex.io/video/v1/rooms/${roomId}/tokens`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader
            },
            body: JSON.stringify({
                name: req.user.name || 'Inakkam User',
                role: role || 'participant',
                user_ref: req.user._id.toString()
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('[EnableX Get Token Error]', data);
            return res.status(response.status).json({
                success: false,
                message: data.message || 'Failed to generate EnableX token'
            });
        }

        return res.json({ success: true, token: data.token });
    } catch (err) {
        next(err);
    }
};

module.exports = { createRoom, getToken };
