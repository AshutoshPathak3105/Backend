const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist
const ensureDir = (dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

ensureDir(path.join(__dirname, '../uploads/resumes'));
ensureDir(path.join(__dirname, '../uploads/avatars'));
ensureDir(path.join(__dirname, '../uploads/logos'));
ensureDir(path.join(__dirname, '../uploads/messages'));

// Storage for resumes
const resumeStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../uploads/resumes'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `resume-${req.user._id}-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

// Storage for images (avatars, logos)
const imageStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = file.fieldname === 'logo' ? '../uploads/logos' : '../uploads/avatars';
        cb(null, path.join(__dirname, dir));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `${file.fieldname}-${req.user._id}-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

// File filters
const resumeFilter = (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Only PDF, DOC, DOCX files are allowed for resumes'), false);
    }
};

const imageFilter = (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed'), false);
    }
};

// Upload instances
exports.uploadResume = multer({
    storage: resumeStorage,
    fileFilter: resumeFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
}).single('resume');

exports.uploadAvatar = multer({
    storage: imageStorage,
    fileFilter: imageFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
}).single('avatar');

exports.uploadLogo = multer({
    storage: imageStorage,
    fileFilter: imageFilter,
    limits: { fileSize: 2 * 1024 * 1024 } // 2MB
}).single('logo');

// Middleware wrapper that handles multer errors gracefully
exports.handleUpload = (uploadFn) => (req, res, next) => {
    uploadFn(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
        } else if (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
        next();
    });
};

// ─── Message file storage (images, videos, documents) ────────────────────────
const messageStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../uploads/messages'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `msg-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const messageFileFilter = (req, file, cb) => {
    const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.mov', '.avi', '.webm', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.zip'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExts.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('File type not allowed'), false);
    }
};

exports.uploadMessageFile = multer({
    storage: messageStorage,
    fileFilter: messageFileFilter,
    limits: { fileSize: 20 * 1024 * 1024 } // 20MB
}).single('file');
