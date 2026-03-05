const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
    lastMessage: { type: String, default: '' },
    lastMessageAt: { type: Date, default: Date.now },
    lastSenderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // Map of userId -> unread count  e.g. { "abc123": 3 }
    unreadCounts: { type: Map, of: Number, default: {} }
}, { timestamps: true });

// Each pair of participants has exactly one conversation
conversationSchema.index({ participants: 1 });

module.exports = mongoose.model('Conversation', conversationSchema);
