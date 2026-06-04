const { Readable } = require('stream');

/**
 * Custom Multer storage engine for Cloudinary v2
 * Compatible with cloudinary@^2.x (no multer-storage-cloudinary dependency needed)
 */
class CloudinaryStorage {
    constructor({ cloudinary, folder, allowedFormats, transformation }) {
        this.cloudinary = cloudinary;
        this.folder = folder;
        this.allowedFormats = allowedFormats;
        this.transformation = transformation;
    }

    _handleFile(req, file, cb) {
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

        const readable = new Readable();
        readable.push(null);
        file.stream.pipe(uploadStream);
    }

    _removeFile(req, file, cb) {
        this.cloudinary.uploader.destroy(file.filename, cb);
    }
}

module.exports = { CloudinaryStorage };
