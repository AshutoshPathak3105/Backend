const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true, maxlength: 1000 },
    createdAt: { type: Date, default: Date.now }
});

const postSchema = new mongoose.Schema({
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, trim: true, maxlength: 3000 },
    media: [{
        url: { type: String, required: true },
        type: { type: String, enum: ['image', 'video'], required: true },
        publicId: { type: String }                // Cloudinary public_id for deletion
    }],
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    comments: [commentSchema],
    shares: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    category: { type: String, enum: ['Technology', 'General', 'Other'], default: 'General' }
}, { timestamps: true });

// Text or at least one media item is required
postSchema.pre('validate', function (next) {
    if (!this.text && (!this.media || this.media.length === 0)) {
        this.invalidate('text', 'Post must have text or media');
    }
    next();
});

module.exports = mongoose.model('Post', postSchema);
