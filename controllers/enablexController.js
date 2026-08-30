const getAuthHeader = () => {
    const appId = process.env.ENABLEX_APP_ID;
    const appKey = process.env.ENABLEX_APP_KEY;

    if (
        !appId ||
        !appKey ||
        appKey === 'your_enablex_app_key_here'
    ) {
        return null;
    }

    return `Basic ${Buffer.from(
        `${appId}:${appKey}`
    ).toString('base64')}`;
};


// ============================================================
// CREATE ENABLEX ROOM
// POST /api/enablex/create-room
// ============================================================
const createRoom = async (req, res, next) => {
    try {
        const { name } = req.body;

        const authHeader = getAuthHeader();

        if (!authHeader) {
            console.error(
                '[EnableX] Credentials are not configured'
            );

            return res.status(500).json({
                success: false,
                message: 'EnableX credentials are not configured'
            });
        }

        const roomBody = {
            name:
                name ||
                `Inakkam Call ${Date.now()}`,

            owner_ref: req.user._id.toString(),

            settings: {
                description:
                    'Inakkam real-time call session',

                mode: 'group',

                scheduled: false,

                // IMPORTANT:
                // Ad-hoc rooms can be recreated when necessary.
                adhoc: true,

                duration: 60
            },

            sip: false
        };

        console.log(
            '[EnableX] Creating NEW room:',
            JSON.stringify(roomBody)
        );

        const response = await fetch(
            'https://api.enablex.io/video/v2/rooms',
            {
                method: 'POST',

                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': authHeader
                },

                body: JSON.stringify(roomBody)
            }
        );

        const data = await response.json();

        console.log(
            '[EnableX] Create room response:',
            JSON.stringify(data)
        );

        if (!response.ok || data.result !== 0) {
            console.error(
                '[EnableX] Create room failed:',
                data
            );

            return res.status(
                response.ok ? 500 : response.status
            ).json({
                success: false,

                message:
                    data.desc ||
                    data.error ||
                    data.message ||
                    'Failed to create EnableX room',

                enablexError: data
            });
        }

        if (!data.room) {
            console.error(
                '[EnableX] Room missing from response:',
                data
            );

            return res.status(500).json({
                success: false,
                message: 'EnableX did not return room information',
                enablexResponse: data
            });
        }

        /*
         * EnableX room object normally contains the room ID.
         * Keep the complete room object so frontend can inspect
         * whatever fields EnableX returns.
         */

        const newRoomId =
            data.room.room_id ||
            data.room.roomId ||
            data.room.id;

        if (!newRoomId) {
            console.error(
                '[EnableX] Could not determine room ID:',
                data.room
            );

            return res.status(500).json({
                success: false,
                message: 'EnableX room ID was not returned',
                room: data.room
            });
        }

        console.log(
            `✅ [EnableX] NEW ROOM CREATED: ${newRoomId}`
        );

        return res.json({
            success: true,

            room: data.room,

            roomId: newRoomId
        });

    } catch (err) {
        console.error(
            '[EnableX] Create room exception:',
            err
        );

        next(err);
    }
};


// ============================================================
// GET PARTICIPANT / MODERATOR TOKEN
// POST /api/enablex/get-token
// ============================================================
const getToken = async (req, res, next) => {
    try {
        const {
            roomId,
            role
        } = req.body;

        if (!roomId) {
            return res.status(400).json({
                success: false,
                message: 'Room ID is required'
            });
        }

        /*
         * IMPORTANT:
         * Never attempt to create a token for a mock room when
         * real EnableX credentials are configured.
         */

        if (roomId.startsWith('mock_')) {
            console.warn(
                '[EnableX] Mock roomId received:',
                roomId
            );

            return res.status(400).json({
                success: false,
                message:
                    'Invalid EnableX room. Real EnableX room required.'
            });
        }

        const authHeader = getAuthHeader();

        if (!authHeader) {
            console.error(
                '[EnableX] Credentials are not configured'
            );

            return res.status(500).json({
                success: false,
                message:
                    'EnableX credentials are not configured'
            });
        }

        const tokenBody = {
            name:
                req.user.name ||
                'Inakkam User',

            role:
                role === 'moderator'
                    ? 'moderator'
                    : 'participant',

            user_ref:
                req.user._id.toString(),

            data: JSON.stringify({
                userId:
                    req.user._id.toString()
            })
        };

        console.log(
            `[EnableX] Generating token: room=${roomId}, role=${tokenBody.role}, user=${req.user._id}`
        );

        const response = await fetch(
            `https://api.enablex.io/video/v2/rooms/${roomId}/tokens`,
            {
                method: 'POST',

                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': authHeader
                },

                body: JSON.stringify(tokenBody)
            }
        );

        const data = await response.json();

        console.log(
            '[EnableX] Token response:',
            JSON.stringify(data)
        );

        if (!response.ok || data.result !== 0) {
            console.error(
                '[EnableX] Token generation failed:',
                data
            );

            return res.status(
                response.ok ? 500 : response.status
            ).json({
                success: false,

                message:
                    data.desc ||
                    data.error ||
                    data.message ||
                    'Failed to generate EnableX token',

                enablexError: data
            });
        }

        const tokenString = data.token;

        if (!tokenString) {
            console.error(
                '[EnableX] No token returned:',
                data
            );

            return res.status(500).json({
                success: false,

                message:
                    'EnableX did not return a token',

                enablexResponse: data
            });
        }

        console.log(
            `✅ [EnableX] Token generated for room ${roomId}`
        );

        return res.json({
            success: true,
            token: tokenString,
            roomId
        });

    } catch (err) {
        console.error(
            '[EnableX] Get token exception:',
            err
        );

        next(err);
    }
};


module.exports = {
    createRoom,
    getToken
};