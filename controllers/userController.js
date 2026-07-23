const User = require('../models/User');
const { cloudinary } = require('../config/cloudinary');
const Notification = require('../models/Notification');
const Language = require('../models/Language');
const Interest = require('../models/Interest');
const Religion = require('../models/Religion');
const RelationGoal = require('../models/RelationGoal');

// @desc    Get current user profile
// @route   GET /api/users/me
// @access  Private
const getMe = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id).lean();
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        return res.json({ success: true, user });
    } catch (err) {
        next(err);
    }
};

// @desc    Update own profile
// @route   PUT /api/users/me
// @access  Private
const updateMe = async (req, res, next) => {
    try {
        const allowed = [
            'name', 'bio', 'work', 'education', 'interests', 'prompts',
            'zodiac', 'height', 'exercise', 'relationship', 'religion',
            'languages', 'gender', 'interestedIn', 'ageRange', 'maxDistance', 'location',
        ];
        const updates = {};
        allowed.forEach((field) => {
            if (req.body[field] !== undefined) updates[field] = req.body[field];
        });

        const user = await User.findByIdAndUpdate(req.user._id, { $set: updates }, { new: true, runValidators: true });
        return res.json({ success: true, user });
    } catch (err) {
        next(err);
    }
};

// @desc    Complete onboarding step
// @route   PUT /api/users/me/onboarding
// @access  Private
const completeOnboarding = async (req, res, next) => {
    try {
        const allowed = [
            'name', 'age', 'gender', 'interestedIn', 'bio', 'work', 'education',
            'interests', 'prompts', 'zodiac', 'height', 'exercise', 'relationship',
            'religion', 'languages', 'location', 'maxDistance', 'photos', 'phone'
        ];
        const updates = {};
        allowed.forEach((field) => {
            if (req.body[field] !== undefined) updates[field] = req.body[field];
        });
        
        if (req.body.photos && Array.isArray(req.body.photos)) {
            updates.photos = req.body.photos.map(p => typeof p === 'string' ? { url: p, publicId: 'mock' } : p);
        }

        updates.isOnboarded = req.body.isComplete === true;

        const user = await User.findByIdAndUpdate(req.user._id, { $set: updates }, { new: true, runValidators: true });
        return res.json({ success: true, user });
    } catch (err) {
        next(err);
    }
};

// @desc    Upload a profile photo
// @route   POST /api/users/me/photos
// @access  Private (file upload handled by multer middleware)
const uploadPhoto = async (req, res, next) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

        const user = await User.findById(req.user._id);
        if (user.photos.length >= 9) {
            return res.status(400).json({ success: false, message: 'Maximum 9 photos allowed' });
        }

        const photo = { url: req.file.path, publicId: req.file.filename };
        user.photos.push(photo);
        await user.save();

        return res.json({ success: true, photo, photos: user.photos });
    } catch (err) {
        next(err);
    }
};

// @desc    Delete a profile photo
// @route   DELETE /api/users/me/photos/:photoId
// @access  Private
const deletePhoto = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id);
        const photo = user.photos.id(req.params.photoId);
        if (!photo) return res.status(404).json({ success: false, message: 'Photo not found' });

<<<<<<< HEAD
        // Delete from Cloudinary if configured or local disk
        try {
            const { isCloudinaryConfigured, cloudinary } = require('../config/cloudinary');
            if (photo.publicId && isCloudinaryConfigured()) {
                await cloudinary.uploader.destroy(photo.publicId);
            } else if (photo.url && photo.url.startsWith('/uploads/')) {
                const fs = require('fs');
                const path = require('path');
                const localPath = path.join(__dirname, '../', photo.url);
                if (fs.existsSync(localPath)) {
                    fs.unlinkSync(localPath);
                }
            }
        } catch (delErr) {
            console.error('[deletePhoto] Failed to delete photo file:', delErr.message);
        }

=======
        // Delete from Cloudinary or Local Storage
        const isConfigured = process.env.CLOUDINARY_API_KEY && 
                             process.env.CLOUDINARY_API_KEY !== 'your_api_key' && 
                             process.env.CLOUDINARY_CLOUD_NAME && 
                             process.env.CLOUDINARY_CLOUD_NAME !== 'your_cloud_name';

        if (isConfigured) {
            await cloudinary.uploader.destroy(photo.publicId);
        } else {
            if (photo.publicId && photo.publicId !== 'mock') {
                const fs = require('fs');
                const path = require('path');
                const filepath = path.join(__dirname, '..', 'uploads', photo.publicId);
                if (fs.existsSync(filepath)) {
                    fs.unlinkSync(filepath);
                }
            }
        }
>>>>>>> 5926cf6595741e6c6b9961dcfd157af82c1e6791
        user.photos.pull({ _id: req.params.photoId });
        await user.save();

        return res.json({ success: true, photos: user.photos });
    } catch (err) {
        next(err);
    }
};

// @desc    Get another user's public profile
// @route   GET /api/users/:id
// @access  Private
const getUserById = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id).select(
            'name age bio work education photos interests prompts zodiac height exercise relationship religion languages verified badges location lastActive isOnline'
        );
        if (!user || user.isDeleted) return res.status(404).json({ success: false, message: 'User not found' });

        // Increment profile views asynchronously without blocking the response
        User.findByIdAndUpdate(req.params.id, { $inc: { profileViews: 1 } })
            .exec()
            .catch((err) => console.error('[User getUserById] Failed to increment profile views', err));

        return res.json({ success: true, user });
    } catch (err) {
        next(err);
    }
};

// @desc    Get all onboarding options
// @route   GET /api/users/onboarding-options
// @access  Private
const getOnboardingOptions = async (req, res, next) => {
    try {
        const [languages, interests, religions, relationGoals] = await Promise.all([
            Language.find({ status: 1 }).sort({ sortOrder: 1, createdAt: -1 }),
            Interest.find({ status: 1 }).sort({ sortOrder: 1, createdAt: -1 }),
            Religion.find({ status: 1 }).sort({ sortOrder: 1, createdAt: -1 }),
            RelationGoal.find({ status: 1 }).sort({ sortOrder: 1, createdAt: -1 }),
        ]);

        return res.json({
            success: true,
            languages,
            interests,
            religions,
            relationGoals
        });
    } catch (err) {
        next(err);
    }
};

module.exports = { getMe, updateMe, completeOnboarding, uploadPhoto, deletePhoto, getUserById, getOnboardingOptions };
