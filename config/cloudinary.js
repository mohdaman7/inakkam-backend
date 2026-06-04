const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { CloudinaryStorage } = require('./cloudinaryStorage');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const photoStorage = new CloudinaryStorage({
    cloudinary,
    folder: 'inakkam/photos',
    allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 800, height: 1000, crop: 'fill', quality: 'auto' }],
});

const storyStorage = new CloudinaryStorage({
    cloudinary,
    folder: 'inakkam/stories',
    allowedFormats: ['jpg', 'jpeg', 'png', 'webp', 'mp4'],
});

const uploadPhoto = multer({
    storage: photoStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Only image files are allowed'), false);
    },
});

const uploadStory = multer({
    storage: storyStorage,
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) cb(null, true);
        else cb(new Error('Only image or video files are allowed'), false);
    },
});

module.exports = { cloudinary, uploadPhoto, uploadStory };
