const Post = require('../models/Post');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');
const Notification = require('../models/Notification');

// ── Multer: store in /uploads/posts ──────────────────────────────────────────
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '..', 'uploads', 'posts');
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedExts = /jpeg|jpg|png|gif|webp|mp4|mov|avi|webm|heic|heif/;
    const allowedMime = /image\/(jpeg|jpg|png|gif|webp|heic|heif)|video\/(mp4|quicktime|x-msvideo|webm|avi|mov)/;
    const extOk = allowedExts.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = allowedMime.test(file.mimetype);
    if (extOk || mimeOk) {
        cb(null, true);
    } else {
        cb(new Error('Only images and videos are allowed'));
    }
};

exports.upload = multer({ storage, fileFilter, limits: { fileSize: 50 * 1024 * 1024 } }); // 50 MB

// helper – base URL for serving local uploads
const mediaURL = (filename) => {
    return `/uploads/posts/${filename}`;
};

// ── GET /posts  (feed – newest first, paginated) ─────────────────────────────
exports.getPosts = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const query = {};
        if (req.query.author) query.author = req.query.author;
        if (req.query.category && req.query.category !== 'All Roles') {
            query.category = req.query.category;
        }

        const posts = await Post.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .populate('author', 'name avatar role headline')
            .populate('comments.user', 'name avatar');
        const total = await Post.countDocuments();
        res.json({ success: true, posts, total, page, pages: Math.ceil(total / limit) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ── POST /posts  (create) ────────────────────────────────────────────────────
exports.createPost = async (req, res) => {
    try {
        const { text, category } = req.body;
        const files = req.files || [];

        if (!text && files.length === 0) {
            return res.status(400).json({ success: false, message: 'Post must have text or media' });
        }

        const media = files.map(f => ({
            url: mediaURL(f.filename),
            type: f.mimetype.startsWith('video') ? 'video' : 'image',
        }));

        const post = await Post.create({
            author: req.user._id,
            text,
            media,
            category: category || 'General'
        });
        await post.populate('author', 'name avatar role headline');

        // Notify friends/connections
        const user = await User.findById(req.user._id);
        if (user && user.connections && user.connections.length > 0) {
            const notifications = user.connections.map(friendId => ({
                recipient: friendId,
                type: 'friend_post',
                title: 'New Post from Friend',
                message: `${user.name} shared a new post.`,
                link: `/posts/${post._id}`,
                meta: { postId: post._id, authorId: user._id }
            }));
            await Notification.insertMany(notifications);
        }

        res.status(201).json({ success: true, post });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ── DELETE /posts/:id ────────────────────────────────────────────────────────
exports.deletePost = async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
        if (post.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Not authorised' });
        }
        // Remove local files
        post.media.forEach(m => {
            const fname = m.url.split('/').pop();
            const fpath = path.join(__dirname, '..', 'uploads', 'posts', fname);
            if (fs.existsSync(fpath)) fs.unlinkSync(fpath);
        });
        await post.deleteOne();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ── PUT /posts/:id/like  (toggle) ────────────────────────────────────────────
exports.toggleLike = async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
        const uid = req.user._id.toString();
        const idx = post.likes.findIndex(l => l.toString() === uid);
        if (idx === -1) post.likes.push(req.user._id);
        else post.likes.splice(idx, 1);
        await post.save();
        res.json({ success: true, likes: post.likes.length, liked: idx === -1 });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ── POST /posts/:id/comment ──────────────────────────────────────────────────
exports.addComment = async (req, res) => {
    try {
        const { text } = req.body;
        if (!text?.trim()) return res.status(400).json({ success: false, message: 'Comment text required' });
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
        post.comments.push({ user: req.user._id, text: text.trim() });
        await post.save();
        await post.populate('comments.user', 'name avatar');
        res.status(201).json({ success: true, comment: post.comments[post.comments.length - 1] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ── DELETE /posts/:id/comment/:cid ──────────────────────────────────────────
exports.deleteComment = async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
        const comment = post.comments.id(req.params.cid);
        if (!comment) return res.status(404).json({ success: false, message: 'Comment not found' });
        if (comment.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Not authorised' });
        }
        comment.deleteOne();
        await post.save();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ── PUT /posts/:id/share  (increment counter) ────────────────────────────────
exports.sharePost = async (req, res) => {
    try {
        const post = await Post.findByIdAndUpdate(req.params.id, { $inc: { shares: 1 } }, { new: true });
        if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
        res.json({ success: true, shares: post.shares });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
// ── PUT /posts/:id/view (increment view counter) ───────────────────────────
exports.viewPost = async (req, res) => {
    try {
        const post = await Post.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } }, { new: true });
        if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
        res.json({ success: true, views: post.views });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
