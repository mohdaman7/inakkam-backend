const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
    users: {
        type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        validate: { validator: v => v.length === 2, message: 'Match must have exactly 2 users' },
    },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });

matchSchema.index({ users: 1 });

module.exports = mongoose.model('Match', matchSchema);
