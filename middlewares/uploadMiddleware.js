const multer = require('multer');
const { cloudinary } = require('../config/cloudinary');
const { Readable } = require('stream');

// ─── In-memory storage (pipe to Cloudinary) ────────────
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (allowed.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only JPG, JPEG, PNG, and PDF files are allowed'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// ─── Upload buffer to Cloudinary ───────────────────────
const uploadToCloudinary = (buffer, folder, filename) => {
    if (!process.env.CLOUDINARY_API_KEY || process.env.CLOUDINARY_API_KEY === 'your_api_key') {
        console.log(`[MOCK] Uploaded ${filename} to ${folder}`);
        return Promise.resolve({ secure_url: `https://via.placeholder.com/800x600?text=${folder}+Document` });
    }
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder: `inakkam/kyc/${folder}`,
                public_id: filename,
                resource_type: 'auto',
                quality: 'auto',
            },
            (error, result) => {
                if (error) return reject(error);
                resolve(result);
            }
        );
        const readable = new Readable();
        readable.push(buffer);
        readable.push(null);
        readable.pipe(stream);
    });
};

module.exports = { upload, uploadToCloudinary };
