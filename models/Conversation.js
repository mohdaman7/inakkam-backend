const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
    participants: {
        type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        validate: { validator: v => v.length === 2, message: 'Conversation must have exactly 2 participants' },
    },
    match: { type: mongoose.Schema.Types.ObjectId, ref: 'Match' },
    lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
    lastMessageAt: { type: Date, default: Date.now },
}, { timestamps: true });

conversationSchema.index({ participants: 1 });
conversationSchema.index({ lastMessageAt: -1 });

module.exports = mongoose.model('Conversation', conversationSchema);
