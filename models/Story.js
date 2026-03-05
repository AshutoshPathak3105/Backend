const mongoose = require('mongoose');

const storySchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: [true, 'Please provide your name']
    },
    role: {
        type: String,
        required: [true, 'Please provide your role/company']
    },
    story: {
        type: String,
        required: [true, 'Please share your story']
    },
    rating: {
        type: Number,
        required: [true, 'Please provide a rating'],
        min: 1,
        max: 5
    },
    avatar: {
        type: String
    },
    company: {
        type: String
    },
    isApproved: {
        type: Boolean,
        default: true // Automatically approved for demo purposes
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Story', storySchema);
