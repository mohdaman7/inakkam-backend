const { pipeline } = require('@xenova/transformers');

let transcriberPromise = null;

const getTranscriber = () => {
    if (!transcriberPromise) {
        console.log('🤖 [AudioSecurity] Initializing Whisper speech recognizer...');
        transcriberPromise = pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en', {
            quantized: true,
        }).then((instance) => {
            console.log('✅ [AudioSecurity] Whisper speech recognizer ready!');
            return instance;
        }).catch((err) => {
            console.error('❌ [AudioSecurity] Failed to initialize Whisper:', err);
            transcriberPromise = null;
            throw err;
        });
    }
    return transcriberPromise;
};

// Eagerly pre-warm Whisper on startup
setTimeout(() => {
    getTranscriber().catch(() => {});
}, 2000);

const DIGIT_WORDS = {
    zero: '0', oh: '0', o: '0',
    one: '1', two: '2', to: '2', too: '2',
    three: '3', tree: '3', four: '4', for: '4', fore: '4',
    five: '5', six: '6', seven: '7',
    eight: '8', ate: '8', nine: '9',

    // Hindi/regional transliterations
    shunya: '0', ek: '1', do: '2', teen: '3', tin: '3',
    chaar: '4', char: '4', paanch: '5', panch: '5',
    chhah: '6', chhe: '6', che: '6', saat: '7', sat: '7',
    aath: '8', ath: '8', nau: '9', no: '9',

    // Malayalam transliterations
    poojyam: '0', onnu: '1', randu: '2', rand: '2',
    moonnu: '3', moonu: '3', naalu: '4', nalu: '4',
    anchu: '5', anju: '5', aaru: '6', aru: '6',
    ezhu: '7', elu: '7', ettu: '8', onpathu: '9', ombathu: '9',
};

const normalizeSpokenNumbers = (rawText = '') => {
    if (!rawText || typeof rawText !== 'string') return '';
    let text = rawText.toLowerCase();

    // Convert "double X" -> "X X", "triple X" -> "X X X"
    text = text.replace(/\bdouble\s+([a-z0-9]+)\b/g, '$1 $1');
    text = text.replace(/\btriple\s+([a-z0-9]+)\b/g, '$1 $1 $1');

    const tokens = text.split(/[\s,.-]+/);
    const converted = tokens.map((t) => DIGIT_WORDS[t] !== undefined ? DIGIT_WORDS[t] : t);
    return converted.join(' ');
};

const checkSpokenPhoneNumber = (rawTranscript = '') => {
    if (!rawTranscript || typeof rawTranscript !== 'string') {
        return { detected: false };
    }

    const normalized = normalizeSpokenNumbers(rawTranscript);

    // 1. Direct 10-digit Indian phone numbers (+91 or starting with 6-9)
    const phonePattern = /(?:(?:\+|0{0,2})91[\s.-]?)?[6-9]\d{9}/;
    const phoneMatch = normalized.replace(/\s+/g, '').match(phonePattern);
    if (phoneMatch) {
        return { detected: true, match: phoneMatch[0], reason: 'indian_mobile_number' };
    }

    // 2. Sequence of 7 or more consecutive digits
    const digitsOnly = normalized.replace(/[^\d]/g, '');
    if (digitsOnly.length >= 7) {
        return { detected: true, match: digitsOnly, reason: 'consecutive_digits_stream' };
    }

    // 3. Spoken digit words sequence (e.g. "nine eight four seven six five four")
    const words = normalized.toLowerCase().split(/\s+/);
    let consecutiveDigits = 0;
    for (const w of words) {
        if (/^\d$/.test(w) || DIGIT_WORDS[w] !== undefined) {
            consecutiveDigits += 1;
            if (consecutiveDigits >= 7) {
                return { detected: true, match: words.join(' '), reason: 'spoken_digit_sequence' };
            }
        } else if (!['and', 'is', 'my', 'number', 'call', 'whatsapp'].includes(w)) {
            consecutiveDigits = 0;
        }
    }

    return { detected: false };
};

/**
 * Process audio PCM chunk from caller or callee
 * @param {Buffer|ArrayBuffer} pcmBuffer - 16-bit PCM mono 16000Hz or Float32Array buffer
 * @param {Object} context - Call context containing roomId, conversationId, userId, targetUserId
 */
const processAudioChunk = async (pcmBuffer, { roomId, conversationId, userId, targetUserId, io, socket }) => {
    try {
        if (!pcmBuffer) return { detected: false };

        const buf = Buffer.isBuffer(pcmBuffer) ? pcmBuffer : Buffer.from(pcmBuffer);
        if (buf.length < 8000) {
            // Less than ~0.25 seconds of audio, ignore
            return { detected: false };
        }

        // Convert 16-bit PCM Buffer (16kHz mono) to Float32Array (-1.0 to 1.0)
        const numSamples = Math.floor(buf.length / 2);
        const float32 = new Float32Array(numSamples);
        let energy = 0;

        for (let i = 0; i < numSamples; i++) {
            const int16 = buf.readInt16LE(i * 2);
            const val = int16 / 32768.0;
            float32[i] = val;
            energy += Math.abs(val);
        }

        const avgEnergy = energy / numSamples;
        // Silence detection threshold: skip running Whisper on background silence
        if (avgEnergy < 0.015) {
            return { detected: false };
        }

        const transcriber = await getTranscriber();
        const result = await transcriber(float32);
        const transcript = result?.text?.trim() || '';

        if (!transcript) return { detected: false };

        console.log(`🎙️ [AudioSecurity] Spoken by user ${userId}: "${transcript}"`);

        const phoneCheck = checkSpokenPhoneNumber(transcript);
        if (phoneCheck.detected) {
            console.warn(`🚨 [AudioSecurity] Phone number detected in spoken audio from user ${userId}!`, phoneCheck);

            const targetUidStr = targetUserId ? String(targetUserId) : null;
            const blockPayload = {
                conversationId: conversationId || roomId,
                roomId: String(roomId || ''),
                reason: 'phone_number_spoken',
                blockedUserId: String(userId),
                detectedText: transcript,
            };

            // 1. Immediately mute/block the violator's own client
            socket.emit('call_audio_security_block', blockPayload);

            // 2. Mute/block the remote call partner's client
            if (targetUidStr && targetUidStr !== 'null' && targetUidStr !== '[object Object]') {
                io.to(`user_${targetUidStr}`).emit('call_audio_security_block', blockPayload);
            }

            // 3. Broadcast to call room
            if (roomId) {
                socket.to(String(roomId)).emit('call_audio_security_block', blockPayload);
            }
            if (conversationId && String(conversationId) !== String(roomId)) {
                socket.to(String(conversationId)).emit('call_audio_security_block', blockPayload);
            }

            return { detected: true, transcript, match: phoneCheck.match };
        }

        return { detected: false, transcript };
    } catch (err) {
        console.error('[AudioSecurity processAudioChunk error]', err);
        return { detected: false, error: err.message };
    }
};

module.exports = {
    getTranscriber,
    checkSpokenPhoneNumber,
    processAudioChunk,
    normalizeSpokenNumbers,
};
