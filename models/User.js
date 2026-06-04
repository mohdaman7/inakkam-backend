const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const promptSchema = new mongoose.Schema({
    question: { type: String, required: true },
    answer: { type: String, required: true },
}, { _id: false });

const photoSchema = new mongoose.Schema({
    url: { type: String, required: true },
    publicId: { type: String, required: true }, // Cloudinary public_id for deletion
}, { _id: true });

const locationSchema = new mongoose.Schema({
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] }, // [longitude, latitude]
    city: String,
    country: String,
}, { _id: false });

const membershipSchema = new mongoose.Schema({
    plan: { type: String, enum: ['free', 'boost', 'premium', 'lifetime'], default: 'free' },
    startDate: Date,
    endDate: Date,
}, { _id: false });

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        unique: true,
        sparse: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Invalid email address'],
    },
    phone: {
        type: String,
        unique: true,
        sparse: true,
        trim: true,
    },
    passwordHash: { type: String, select: false },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    age: { type: Number, min: 18, max: 99 },
    bio: { type: String, maxlength: 500, default: '' },
    work: { type: String, maxlength: 100, default: '' },
    education: { type: String, maxlength: 100, default: '' },
    location: { type: locationSchema, default: () => ({}) },
    photos: { type: [photoSchema], default: [], validate: v => v.length <= 9 },
    interests: { type: [String], default: [], validate: v => v.length <= 20 },
    prompts: { type: [promptSchema], default: [], validate: v => v.length <= 3 },
    zodiac: { type: String, enum: ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces', ''], default: '' },
    height: { type: String, default: '' },
    exercise: { type: String, enum: ['Never', 'Sometimes', 'Often', 'Active', 'Very Active', 'Daily', ''], default: '' },
    relationship: { type: String, default: '' },
    religion: { type: String, default: '' },
    languages: { type: [String], default: [] },
    gender: { type: String, enum: ['Man', 'Woman', 'Non-binary', 'Prefer not to say', ''], default: '' },
    interestedIn: { type: [String], default: [] },
    ageRange: { min: { type: Number, default: 18 }, max: { type: Number, default: 45 } },
    maxDistance: { type: Number, default: 50 }, // km
    verified: { type: Boolean, default: false },
    badges: { type: [String], default: [] },
    membership: { type: membershipSchema, default: () => ({}) },
    isOnboarded: { type: Boolean, default: false },
    lastActive: { type: Date, default: Date.now },
    isOnline: { type: Boolean, default: false },
    blockedUsers: { type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [] },
    refreshToken: { type: String, select: false },
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpires: { type: Date, select: false },
    isDeleted: { type: Boolean, default: false },
    likesCount: { type: Number, default: 0 },
    matchesCount: { type: Number, default: 0 },
    profileViews: { type: Number, default: 0 },
}, { timestamps: true });

userSchema.index({ location: '2dsphere' });

// Hash password before save
userSchema.pre('save', async function (next) {
    if (!this.isModified('passwordHash')) return next();
    this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
    next();
});

// Compare password
userSchema.methods.matchPassword = async function (plainText) {
    return bcrypt.compare(plainText, this.passwordHash);
};

// Public profile — strip sensitive fields
userSchema.methods.toPublicProfile = function () {
    const obj = this.toObject();
    delete obj.passwordHash;
    delete obj.refreshToken;
    delete obj.resetPasswordToken;
    delete obj.resetPasswordExpires;
    delete obj.blockedUsers;
    delete obj.isDeleted;
    delete obj.email;
    delete obj.phone;
    return obj;
};

module.exports = mongoose.model('User', userSchema);
