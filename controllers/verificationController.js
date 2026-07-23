const Verification = require('../models/Verification');
const User = require('../models/User');
const { uploadToCloudinary } = require('../middlewares/uploadMiddleware');

// ─── Helper: update user verificationStatus ────────────
const syncUserStatus = async (userId, status) => {
    await User.findByIdAndUpdate(userId, { $set: { verificationStatus: status } });
};

// ────────────────────────────────────────────────────────
// @desc    Submit / Update KYC verification request
// @route   POST /api/verification/submit
// @access  Private
// ────────────────────────────────────────────────────────
const submitVerification = async (req, res, next) => {
    try {
        const userId = req.user._id;

        // Prevent re-submission if already verified or pending
        const existing = await Verification.findOne({ userId });
        if (existing && ['PENDING_VERIFICATION', 'UNDER_VERIFICATION', 'VERIFIED'].includes(existing.status)) {
            return res.status(400).json({
                success: false,
                message: `Verification already ${existing.status.toLowerCase().replace(/_/g, ' ')}.`,
            });
        }

        const body = req.body;
        const files = req.files || {};

        // ─── Upload documents to Cloudinary ──────────
        let aadhaarFrontUrl = existing?.aadhaarFront;
        let aadhaarBackUrl  = existing?.aadhaarBack;
        let panCardUrl      = existing?.panCard;

        if (files.aadhaarFront?.[0]) {
            const result = await uploadToCloudinary(files.aadhaarFront[0].buffer, 'aadhaar', `${userId}_aadhaar_front`);
            aadhaarFrontUrl = result.secure_url;
        }
        if (files.aadhaarBack?.[0]) {
            const result = await uploadToCloudinary(files.aadhaarBack[0].buffer, 'aadhaar', `${userId}_aadhaar_back`);
            aadhaarBackUrl = result.secure_url;
        }
        if (files.panCard?.[0]) {
            const result = await uploadToCloudinary(files.panCard[0].buffer, 'pan', `${userId}_pan`);
            panCardUrl = result.secure_url;
        }

        // ─── Handle selfie (Base64 or file) ──────────
        let selfieUrl = existing?.selfieImage || '';
        if (body.selfieImage && body.selfieImage.startsWith('data:image')) {
            // Upload base64 selfie to Cloudinary
            const result = await cloudinaryUploadBase64(body.selfieImage, userId);
            selfieUrl = result;
        } else if (files.selfieImage?.[0]) {
            const result = await uploadToCloudinary(files.selfieImage[0].buffer, 'selfie', `${userId}_selfie`);
            selfieUrl = result.secure_url;
        }

        const verificationData = {
            userId,
            fullName:    body.fullName,
            dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : undefined,
            gender:      body.gender,
            phone:       body.phone,
            email:       body.email,
            address:     body.address,
            city:        body.city,
            state:       body.state,
            pincode:     body.pincode,
            occupation:  body.occupation,
            aadhaarFront: aadhaarFrontUrl,
            aadhaarBack:  aadhaarBackUrl,
            panCard:      panCardUrl,
            selfieImage:  selfieUrl,
            paymentMethod: body.paymentMethod,
            bankDetails: body.paymentMethod === 'bank' ? {
                accountHolderName: body.accountHolderName,
                bankName:          body.bankName,
                accountNumber:     body.accountNumber,
                ifscCode:          body.ifscCode,
            } : {},
            upiId:       body.paymentMethod === 'upi' ? body.upiId : '',
            status:      'PENDING_VERIFICATION',
            submittedAt: new Date(),
        };

        let verification;
        if (existing) {
            verification = await Verification.findOneAndUpdate(
                { userId },
                { $set: verificationData },
                { new: true, runValidators: true }
            );
        } else {
            verification = await Verification.create(verificationData);
        }

        // Update user's verification status
        await syncUserStatus(userId, 'PENDING_VERIFICATION');

        return res.status(200).json({
            success: true,
            message: 'Verification request submitted successfully.',
            verification,
        });
    } catch (err) {
        next(err);
    }
};

// ─── Helper: upload base64 image to Local Disk or Cloudinary ─────────
const cloudinaryUploadBase64 = async (base64String, userId) => {
    const { isCloudinaryConfigured, cloudinary } = require('../config/cloudinary');
    const path = require('path');
    const fs = require('fs');

    if (!isCloudinaryConfigured()) {
        const targetDir = path.join(__dirname, '../uploads/kyc/selfie');
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        const crypto = require('crypto');
        const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        const buffer = matches ? Buffer.from(matches[2], 'base64') : Buffer.from(base64String, 'base64');
        const randomHex = crypto.randomBytes(8).toString('hex');
        const filename = `selfie_${userId}_${Date.now()}_${randomHex}.jpg`;
        const filePath = path.join(targetDir, filename);

        fs.writeFileSync(filePath, buffer);
        console.log(`[LOCAL MULTER] Saved selfie to /uploads/kyc/selfie/${filename}`);
        return `/uploads/kyc/selfie/${filename}`;
    }

    const result = await cloudinary.uploader.upload(base64String, {
        folder: `inakkam/kyc/selfie`,
        public_id: `${userId}_selfie`,
        resource_type: 'image',
    });
    return result.secure_url;
};

// ────────────────────────────────────────────────────────
// @desc    Get own verification status
// @route   GET /api/verification/status
// @access  Private
// ────────────────────────────────────────────────────────
const getVerificationStatus = async (req, res, next) => {
    try {
        const verification = await Verification.findOne({ userId: req.user._id }).lean();
        if (!verification) {
            return res.json({
                success: true,
                status: 'NOT_VERIFIED',
                verification: null,
            });
        }
        return res.json({
            success: true,
            status: verification.status,
            verification,
        });
    } catch (err) {
        next(err);
    }
};

// ────────────────────────────────────────────────────────
// @desc    Get all verifications (Admin only)
// @route   GET /api/verification/admin/all
// @access  Private (Admin)
// ────────────────────────────────────────────────────────
const getAllVerifications = async (req, res, next) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const filter = status ? { status } : {};
        const verifications = await Verification.find(filter)
            .populate('userId', 'name email phone')
            .sort({ submittedAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .lean();
        const total = await Verification.countDocuments(filter);

        return res.json({ success: true, verifications, total, page: parseInt(page), limit: parseInt(limit) });
    } catch (err) {
        next(err);
    }
};

// ────────────────────────────────────────────────────────
// @desc    Update verification status (Admin)
// @route   PATCH /api/verification/admin/:id/status
// @access  Private (Admin)
// ────────────────────────────────────────────────────────
const updateVerificationStatus = async (req, res, next) => {
    try {
        const { status, rejectionReason } = req.body;
        const allowedStatuses = ['UNDER_VERIFICATION', 'VERIFIED', 'REJECTED'];
        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status value.' });
        }

        const verification = await Verification.findByIdAndUpdate(
            req.params.id,
            {
                $set: {
                    status,
                    rejectionReason: status === 'REJECTED' ? rejectionReason : undefined,
                    reviewedAt: new Date(),
                    reviewedBy: req.admin?._id || req.user?._id,
                },
            },
            { new: true }
        );

        if (!verification) {
            return res.status(404).json({ success: false, message: 'Verification not found.' });
        }

        // Sync status to user
        await syncUserStatus(verification.userId, status);

        return res.json({ success: true, message: `Verification ${status.toLowerCase()}.`, verification });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    submitVerification,
    getVerificationStatus,
    getAllVerifications,
    updateVerificationStatus,
};
