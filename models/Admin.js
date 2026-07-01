const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    passwordHash: { type: String, required: true, select: false },
    role: {
        type: String,
        enum: ['superadmin', 'admin', 'moderator'],
        default: 'admin',
    },
    permissions: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },
    avatar: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },
    refreshToken: { type: String, select: false },
}, { timestamps: true });

// Hash password before save
adminSchema.pre('save', async function () {
    if (!this.isModified('passwordHash')) return;
    this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
});

// Compare password
adminSchema.methods.matchPassword = async function (plainText) {
    return bcrypt.compare(plainText, this.passwordHash);
};

module.exports = mongoose.model('Admin', adminSchema);
