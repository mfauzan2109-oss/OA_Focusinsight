const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '..', 'uploads');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const cleanFileName = Date.now() + '_' + file.originalname.replace(/\s+/g, '_');
        cb(null, cleanFileName);
    }
});

const upload = multer({ storage: storage });

module.exports = upload;
