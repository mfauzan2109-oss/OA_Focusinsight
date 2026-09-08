const multer = require('multer');
const fs = require('fs');
const path = require('path');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '..', 'uploads');

        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        cb(null, uploadDir);
    },

    filename: (req, file, cb) => {
        const cleanFileName =
            Date.now() + '_' + file.originalname.replace(/\s+/g, '_');

        cb(null, cleanFileName);
    }
});

const allowedMimeTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png'
];

const allowedExtensions = [
    '.pdf',
    '.jpg',
    '.jpeg',
    '.png'
];

const fileFilter = (req, file, cb) => {
    const ext = path
        .extname(file.originalname)
        .toLowerCase();

    const validMime =
        allowedMimeTypes.includes(file.mimetype);

    const validExtension =
        allowedExtensions.includes(ext);

    if (validMime && validExtension) {
        return cb(null, true);
    }

    return cb(
        new Error(
            'Invalid file type. Only PDF, JPG, JPEG and PNG files are allowed.'
        ),
        false
    );
};

const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024
    },
    fileFilter
});

module.exports = upload;