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
        const cleanFileName = `${Date.now()}_${file.originalname.replace(/\s+/g, '_')}`;
        cb(null, cleanFileName);
    }
});

// Front-end forms only check file type in the browser, which is easy to
// bypass by calling the API directly. Enforce the same PDF/JPG/PNG
// restriction (plus a size cap) here as well.
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

const fileFilter = (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        return cb(new Error('Only PDF, JPG, or PNG files are allowed.'));
    }
    cb(null, true);
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: MAX_FILE_SIZE_BYTES }
});

module.exports = upload;
