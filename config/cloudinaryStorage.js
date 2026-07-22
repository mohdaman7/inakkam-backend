const { Readable } = require('stream');
const fs = require('fs');
const path = require('path');

/**
 * Custom Multer storage engine for Cloudinary v2
 * Compatible with cloudinary@^2.x (no multer-storage-cloudinary dependency needed)
 * Falls back to local storage if Cloudinary is not configured.
 */
class CloudinaryStorage {
    constructor({ cloudinary, folder, allowedFormats, transformation }) {
        this.cloudinary = cloudinary;
        this.folder = folder;
        this.allowedFormats = allowedFormats;
        this.transformation = transformation;
    }

    _handleFile(req, file, cb) {
        const isConfigured = process.env.CLOUDINARY_API_KEY && 
                             process.env.CLOUDINARY_API_KEY !== 'your_api_key' && 
                             process.env.CLOUDINARY_CLOUD_NAME && 
                             process.env.CLOUDINARY_CLOUD_NAME !== 'your_cloud_name';

        if (!isConfigured) {
            // Local fallback
            const uploadDir = path.join(__dirname, '..', 'uploads', this.folder);
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const ext = path.extname(file.originalname) || '.jpg';
            const filename = file.fieldname + '-' + uniqueSuffix + ext;
            const filepath = path.join(uploadDir, filename);

            const outStream = fs.createWriteStream(filepath);
            file.stream.pipe(outStream);
            outStream.on('error', cb);
            outStream.on('finish', () => {
                const baseUrl = `${req.protocol}://${req.get('host')}`;
                const relativePath = `/uploads/${this.folder}/${filename}`;
                cb(null, {
                    path: `${baseUrl}${relativePath}`,
                    filename: `${this.folder}/${filename}`,
                    size: outStream.bytesWritten,
                    mimetype: file.mimetype,
                });
            });
            return;
        }

        const uploadStream = this.cloudinary.uploader.upload_stream(
            {
                folder: this.folder,
                allowed_formats: this.allowedFormats,
                transformation: this.transformation,
            },
            (error, result) => {
                if (error) return cb(error);
                cb(null, {
                    path: result.secure_url,
                    filename: result.public_id,
                    size: result.bytes,
                    mimetype: file.mimetype,
                });
            }
        );

        file.stream.pipe(uploadStream);
    }

    _removeFile(req, file, cb) {
        const isConfigured = process.env.CLOUDINARY_API_KEY && 
                             process.env.CLOUDINARY_API_KEY !== 'your_api_key' && 
                             process.env.CLOUDINARY_CLOUD_NAME && 
                             process.env.CLOUDINARY_CLOUD_NAME !== 'your_cloud_name';

        if (!isConfigured) {
            if (file.filename) {
                const filepath = path.join(__dirname, '..', 'uploads', file.filename);
                if (fs.existsSync(filepath)) {
                    fs.unlink(filepath, cb);
                } else {
                    cb(null);
                }
            } else {
                cb(null);
            }
            return;
        }

        this.cloudinary.uploader.destroy(file.filename, cb);
    }
}

module.exports = { CloudinaryStorage };
