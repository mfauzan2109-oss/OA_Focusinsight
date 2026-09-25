const multer = require('multer');
const fs = require('fs');
const path = require('path');

const uploadDir = path.join(
    __dirname,
    '..',
    'uploads',
    'profile-pictures'
);

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },

    filename: (req, file, cb) => {
        const safeUserId = String(req.params.id || 'user')
            .replace(/[^a-zA-Z0-9_-]/g, '');

        const extensionMap = {
            'image/jpeg': '.jpg',
            'image/png': '.png',
            'image/webp': '.webp'
        };

        const extension = extensionMap[file.mimetype] || '.jpg';

        cb(
            null,
            `${safeUserId}-${Date.now()}${extension}`
        );
    }
});

const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/webp'
];

const fileFilter = (req, file, cb) => {
    if (!allowedTypes.includes(file.mimetype)) {
        return cb(
            new Error('Only JPG, PNG, or WEBP images are allowed.')
        );
    }

    cb(null, true);
};

const profileUpload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024
    }
});

module.exports = profileUpload;