const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { CloudinaryStorage } = require('./cloudinaryStorage');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const isCloudinaryConfigured = () => {
    const name = process.env.CLOUDINARY_CLOUD_NAME;
    const key = process.env.CLOUDINARY_API_KEY;
    return Boolean(name && name !== 'your_cloud_name' && key && key !== 'your_api_key');
};

// ─── Local Multer Disk Storage Engine ────────────────────────
class LocalMulterStorage {
    constructor({ folder }) {
        this.folder = folder || 'photos';
    }

    _handleFile(req, file, cb) {
        const uploadDir = path.join(__dirname, '../uploads', this.folder);
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const crypto = require('crypto');
        const ext = path.extname(file.originalname) || '.jpg';
        const randomHex = crypto.randomBytes(8).toString('hex');
        const prefix = this.folder.endsWith('s') ? this.folder.slice(0, -1) : this.folder;
        const filename = `${prefix}_${Date.now()}_${randomHex}${ext}`;
        const filePath = path.join(uploadDir, filename);

        const outStream = fs.createWriteStream(filePath);
        file.stream.pipe(outStream);

        outStream.on('error', (err) => cb(err));
        outStream.on('finish', () => {
            const publicPath = `/uploads/${this.folder}/${filename}`;
            cb(null, {
                path: publicPath,
                filename: `${this.folder}/${filename}`,
                publicId: `${this.folder}/${filename}`,
                size: outStream.bytesWritten,
                mimetype: file.mimetype,
            });
        });
    }

    _removeFile(req, file, cb) {
        const filePath = path.join(__dirname, '../', file.path);
        if (fs.existsSync(filePath)) {
            fs.unlink(filePath, cb);
        } else {
            cb(null);
        }
    }
}

// ─── Get Storage Engine (Cloudinary if configured, else Local Multer Disk) ──────
const getStorage = (folder, allowedFormats, transformation) => {
    if (isCloudinaryConfigured()) {
        return new CloudinaryStorage({ cloudinary, folder: `inakkam/${folder}`, allowedFormats, transformation });
    }
    return new LocalMulterStorage({ folder });
};

const photoStorage = getStorage('photos', ['jpg', 'jpeg', 'png', 'webp'], [{ width: 800, height: 1000, crop: 'fill', quality: 'auto' }]);
const storyStorage = getStorage('stories', ['jpg', 'jpeg', 'png', 'webp', 'mp4']);

const uploadPhoto = multer({
    storage: photoStorage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Only image files are allowed'), false);
    },
});

const uploadStory = multer({
    storage: storyStorage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) cb(null, true);
        else cb(new Error('Only image or video files are allowed'), false);
    },
});

module.exports = { cloudinary, uploadPhoto, uploadStory, isCloudinaryConfigured };

