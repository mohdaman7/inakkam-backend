const Message = require('../models/Message');
const Conversation = require('../models/Conversation');

/**
 * Actively purge messages older than 24 hours and clean up stale conversation pointers.
 */
const purgeExpiredMessages = async () => {
    try {
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const now = new Date();

        // 1. Delete all messages created more than 24 hours ago OR whose expireAt timestamp has passed
        const deleteResult = await Message.deleteMany({
            $or: [
                { createdAt: { $lt: cutoff } },
                { expireAt: { $lt: now } },
            ]
        });

        if (deleteResult.deletedCount > 0) {
            console.log(`🧹 [Chat Auto-Clean] Cleared ${deleteResult.deletedCount} messages older than 24 hours`);
        }

        // 2. Unset lastMessage from conversations whose last activity was more than 24 hours ago
        const convResult = await Conversation.updateMany(
            { lastMessageAt: { $lt: cutoff } },
            { $unset: { lastMessage: 1 } }
        );

        if (convResult.modifiedCount > 0) {
            console.log(`🧹 [Chat Auto-Clean] Reset lastMessage preview for ${convResult.modifiedCount} stale conversations`);
        }
    } catch (err) {
        console.error('❌ [Chat Auto-Clean Error]:', err.message);
    }
};

/**
 * Initialize background scheduled cleaner (runs on startup and every 10 minutes)
 */
const initChatAutoCleaner = () => {
    console.log('⏰ [Chat Auto-Clean] Initializing 24-hour chat auto-cleaner service...');

    // Run initial cleanup 5 seconds after server boots
    setTimeout(() => {
        purgeExpiredMessages().catch((e) => console.error('[Chat Auto-Clean Startup Error]:', e));
    }, 5000);

    // Schedule recurring cleanup every 10 minutes
    const interval = setInterval(() => {
        purgeExpiredMessages().catch((e) => console.error('[Chat Auto-Clean Interval Error]:', e));
    }, 10 * 60 * 1000);

    if (interval.unref) interval.unref();
};

module.exports = {
    purgeExpiredMessages,
    initChatAutoCleaner,
};
