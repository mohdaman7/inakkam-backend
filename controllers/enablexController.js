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
// Small in-memory circuit breaker.
//
// EnableX starts returning HTTP 429 ("Too Many Requests") when
// the app id/key exceeds its plan's rate limit. Once that
// happens, immediately retrying create-room/get-token just
// generates more 429s and digs the rate-limit window deeper
// (this is what was happening: every failed call retried token
// creation, which kept re-triggering 429s).
//
// This breaker remembers the last time we got a 429 from
// EnableX and, for a short cooldown window, short-circuits new
// requests locally instead of hitting EnableX again. This is a
// simple in-process safeguard — for multi-instance deployments,
// back this with Redis instead of a module-level variable.
// ============================================================
const RATE_LIMIT_COOLDOWN_MS = 15 * 1000; // 15s local cooldown after a 429
let rateLimitedUntil = 0;

const isInCooldown = () => Date.now() < rateLimitedUntil;

const startCooldown = (retryAfterHeader) => {
    const retryAfterMs = retryAfterHeader
        ? Number(retryAfterHeader) * 1000
        : null;

    rateLimitedUntil = Date.now() + (
        retryAfterMs && !Number.isNaN(retryAfterMs)
            ? retryAfterMs
            : RATE_LIMIT_COOLDOWN_MS
    );
};

const rateLimitedResponse = (res, retryAfterHeader) => {
    const retryAfterSeconds = retryAfterHeader
        ? Number(retryAfterHeader)
        : Math.ceil(RATE_LIMIT_COOLDOWN_MS / 1000);

    res.set('Retry-After', String(retryAfterSeconds));

    return res.status(429).json({
        success: false,
        rateLimited: true,
        message:
            'Video service is temporarily rate-limited. Please wait a moment and try again.',
        retryAfterSeconds
    });
};

// ============================================================
// CREATE ENABLEX ROOM
// POST /api/enablex/create-room
// ============================================================
const createRoom = async (req, res, next) => {
    try {
        if (isInCooldown()) {
            console.warn(
                '[EnableX] create-room short-circuited (local rate-limit cooldown active)'
            );
            return rateLimitedResponse(res);
        }

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

                mode: 'p2p',

                scheduled: false,

                // IMPORTANT:
                // Ad-hoc rooms can be recreated when necessary.
                adhoc: true,

                duration: 60,

                participants: 2,

                quality: 'HD',

                auto_recording: false,

                screen_share: true
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

        // --------------------------------------------------
        // Handle EnableX rate limiting explicitly.
        // A 429 has no JSON body worth parsing as EnableX room
        // data, and repeatedly retrying it just makes things
        // worse, so we short-circuit future requests locally
        // for a short cooldown window.
        // --------------------------------------------------
        if (response.status === 429) {
            const retryAfterHeader = response.headers.get('Retry-After');

            console.error(
                '[EnableX] ❌ create-room RATE LIMITED (429). Retry-After:',
                retryAfterHeader
            );

            startCooldown(retryAfterHeader);

            return rateLimitedResponse(res, retryAfterHeader);
        }

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
        if (isInCooldown()) {
            console.warn(
                '[EnableX] get-token short-circuited (local rate-limit cooldown active)'
            );
            return rateLimitedResponse(res);
        }

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

        // --------------------------------------------------
        // Handle EnableX rate limiting explicitly (see
        // createRoom above for why this matters).
        // --------------------------------------------------
        if (response.status === 429) {
            const retryAfterHeader = response.headers.get('Retry-After');

            console.error(
                '[EnableX] ❌ get-token RATE LIMITED (429). Retry-After:',
                retryAfterHeader
            );

            startCooldown(retryAfterHeader);

            return rateLimitedResponse(res, retryAfterHeader);
        }

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