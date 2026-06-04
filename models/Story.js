const mongoose = require('mongoose');

const storySchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    mediaUrl: { type: String, required: true },
    mediaPublicId: { type: String },
    mediaType: { type: String, enum: ['image', 'video'], default: 'image' },
    viewers: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [] },
    expiresAt: { type: Date, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) }, // 24h
}, { timestamps: true });

storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL auto-delete
storySchema.index({ user: 1 });

module.exports = mongoose.model('Story', storySchema);
