const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');
const fs = require('fs');

dotenv.config();

// ── Validate required environment variables before anything else ─────────────
const REQUIRED_ENV = ['MONGO_URI', 'JWT_SECRET'];
const missingEnv = REQUIRED_ENV.filter(key => !process.env[key]);
if (missingEnv.length > 0) {
    console.error('❌ Missing required environment variables:', missingEnv.join(', '));
    console.error('   Set them in your .env file locally or in the Render dashboard under Environment.');
    process.exit(1);
}

const app = express();

// Ensure upload directories exist on startup
['uploads/resumes', 'uploads/avatars', 'uploads/logos', 'uploads/messages', 'uploads/posts'].forEach(dir => {
    const fullPath = path.join(__dirname, dir);
    if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath, { recursive: true });
});

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: { success: false, message: 'Too many requests from this IP, please try again later.' }
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { success: false, message: 'Too many login attempts, please try again in 15 minutes.' }
});

// Middleware
// Restrict origins based on CLIENT_URL env var in production
const allowedOrigins = process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(',')
        .map(o => o.trim())
        .filter(Boolean)
    : ['http://localhost:3000'];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, curl)
        if (!origin) return callback(null, true);
        if (
            process.env.NODE_ENV === 'development' ||
            allowedOrigins.includes(origin)
        ) {
            return callback(null, true);
        }
        return callback(new Error(`CORS: Origin '${origin}' not allowed`));
    },
    credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));
app.use('/api', limiter);

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authLimiter, require('./routes/authRoutes'));
app.use('/api/jobs', require('./routes/jobRoutes'));
app.use('/api/applications', require('./routes/applicationRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/companies', require('./routes/companyRoutes'));
app.use('/api/ai', require('./routes/aiRoutes'));
app.use('/api/categories', require('./routes/categoryRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/stories', require('./routes/storyRoutes'));
app.use('/api/search', require('./routes/searchRoutes'));
app.use('/api/messages', require('./routes/messageRoutes'));
app.use('/api/posts', require('./routes/postRoutes'));
app.use('/api/connections', require('./routes/connectionRoutes'));

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'OK',
        message: 'Job Portal API is running',
        timestamp: new Date(),
        environment: process.env.NODE_ENV
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('❌ Error:', err.stack);

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map(e => e.message);
        return res.status(400).json({ success: false, message: messages.join(', ') });
    }

    // Mongoose duplicate key
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        return res.status(400).json({ success: false, message: `${field} already exists` });
    }

    // JWT error
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal Server Error'
    });
});

// Connect to MongoDB and start server
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('✅ MongoDB Connected');
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Server running on all interfaces at port ${PORT}`);
            console.log(`📡 API: http://localhost:${PORT}/api`);
        });
    })
    .catch(err => {
        console.error('❌ MongoDB connection error:', err.message);
        process.exit(1);
    });

module.exports = app;