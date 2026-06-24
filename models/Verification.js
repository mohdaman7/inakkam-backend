const mongoose = require('mongoose');

const bankDetailsSchema = new mongoose.Schema({
    accountHolderName: { type: String, trim: true },
    bankName: { type: String, trim: true },
    accountNumber: { type: String, trim: true },
    ifscCode: { type: String, trim: true, uppercase: true },
}, { _id: false });

const verificationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
    },

    // ─── Step 1: Personal Info ──────────────────────────
    fullName:    { type: String, trim: true },
    dateOfBirth: { type: Date },
    gender:      { type: String, enum: ['Male', 'Female', 'Non-Binary', 'Prefer not to say', ''], default: '' },
    phone:       { type: String, trim: true },
    email:       { type: String, trim: true, lowercase: true },
    address:     { type: String, trim: true },
    city:        { type: String, trim: true },
    state:       { type: String, trim: true },
    pincode:     { type: String, trim: true },
    occupation:  { type: String, trim: true },

    // ─── Step 2: Aadhaar ────────────────────────────────
    aadhaarFront: { type: String },  // Cloudinary URL
    aadhaarBack:  { type: String },  // Cloudinary URL

    // ─── Step 3: PAN ────────────────────────────────────
    panCard: { type: String },        // Cloudinary URL

    // ─── Step 4: Selfie / Face ──────────────────────────
    selfieImage: { type: String },    // Base64 or Cloudinary URL

    // ─── Step 5: Payment ────────────────────────────────
    paymentMethod: { type: String, enum: ['bank', 'upi', ''], default: '' },
    bankDetails:   { type: bankDetailsSchema, default: () => ({}) },
    upiId:         { type: String, trim: true },

    // ─── Status ─────────────────────────────────────────
    status: {
        type: String,
        enum: ['NOT_VERIFIED', 'PENDING_VERIFICATION', 'UNDER_VERIFICATION', 'VERIFIED', 'REJECTED'],
        default: 'PENDING_VERIFICATION',
    },
    rejectionReason: { type: String },
    submittedAt:     { type: Date },
    reviewedAt:      { type: Date },
    reviewedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('Verification', verificationSchema);
