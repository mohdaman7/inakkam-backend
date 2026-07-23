const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { cloudinary, isCloudinaryConfigured } = require('../config/cloudinary');
const { Readable } = require('stream');

// ─── In-memory storage (buffers passed to Cloudinary or disk) ────
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
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// ─── Upload buffer to Local Disk or Cloudinary ─────────
const uploadToCloudinary = (buffer, folder, filename) => {
    if (!isCloudinaryConfigured()) {
        const targetDir = path.join(__dirname, '../uploads/kyc', folder);
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        const crypto = require('crypto');
        const ext = filename.endsWith('.pdf') ? '.pdf' : '.jpg';
        const randomHex = crypto.randomBytes(8).toString('hex');
        const cleanFilename = `${folder}_${Date.now()}_${randomHex}${ext}`;
        const filePath = path.join(targetDir, cleanFilename);

        fs.writeFileSync(filePath, buffer);
        console.log(`[LOCAL MULTER] Saved KYC file to /uploads/kyc/${folder}/${cleanFilename}`);
        return Promise.resolve({ secure_url: `/uploads/kyc/${folder}/${cleanFilename}` });
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

