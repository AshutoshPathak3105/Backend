const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');

// ─── Get all conversations for the logged-in user ────────────────────────────
exports.getConversations = async (req, res) => {
    try {
        const conversations = await Conversation.find({
            participants: req.user._id
        })
            .populate('participants', 'name avatar headline role')
            .sort({ lastMessageAt: -1 });

        // Attach unread count for the current user
        const result = conversations.map(c => {
            const plain = c.toObject();
            plain.unreadCount = c.unreadCounts?.get(req.user._id.toString()) || 0;
            // The "other" participant(s) — filter out current user
            plain.others = plain.participants.filter(
                p => p._id.toString() !== req.user._id.toString()
            );
            return plain;
        });

        res.json({ success: true, conversations: result });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── Start or get existing conversation with another user ────────────────────
exports.getOrCreateConversation = async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ success: false, message: 'userId is required' });
        if (userId === req.user._id.toString()) {
            return res.status(400).json({ success: false, message: 'Cannot message yourself' });
        }

        const other = await User.findById(userId).select('name avatar headline role');
        if (!other) return res.status(404).json({ success: false, message: 'User not found' });

        // Find existing conversation between these two users
        let convo = await Conversation.findOne({
            participants: { $all: [req.user._id, userId], $size: 2 }
        }).populate('participants', 'name avatar headline role');

        if (!convo) {
            convo = await Conversation.create({
                participants: [req.user._id, userId]
            });
            convo = await convo.populate('participants', 'name avatar headline role');
        }

        const plain = convo.toObject();
        plain.unreadCount = convo.unreadCounts?.get(req.user._id.toString()) || 0;
        plain.others = plain.participants.filter(
            p => p._id.toString() !== req.user._id.toString()
        );

        res.json({ success: true, conversation: plain });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── Get messages in a conversation ──────────────────────────────────────────
exports.getMessages = async (req, res) => {
    try {
        const { conversationId } = req.params;

        // Ensure user is a participant
        const convo = await Conversation.findOne({
            _id: conversationId,
            participants: req.user._id
        });
        if (!convo) return res.status(403).json({ success: false, message: 'Access denied' });

        const allMessages = await Message.find({ conversation: conversationId })
            .populate('sender', 'name avatar')
            .sort({ createdAt: 1 });

        // Filter out messages the current user has deleted for themselves
        const messages = allMessages.filter(
            m => !m.deletedFor.map(id => id.toString()).includes(req.user._id.toString())
        );

        // Mark all as read for current user — reset their unread count
        convo.unreadCounts.set(req.user._id.toString(), 0);
        await convo.save();

        // Mark messages as read
        await Message.updateMany(
            { conversation: conversationId, isReadBy: { $ne: req.user._id } },
            { $addToSet: { isReadBy: req.user._id } }
        );

        res.json({ success: true, messages });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── Send a message ───────────────────────────────────────────────────────────
exports.sendMessage = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { content } = req.body;

        if (!content?.trim()) {
            return res.status(400).json({ success: false, message: 'Message content is required' });
        }


        const convo = await Conversation.findOne({
            _id: conversationId,
            participants: req.user._id
        });
        if (!convo) return res.status(403).json({ success: false, message: 'Access denied' });

        const message = await Message.create({
            conversation: conversationId,
            sender: req.user._id,
            content: content.trim(),
            isReadBy: [req.user._id]
        });

        const populated = await message.populate('sender', 'name avatar');

        // Update conversation's last message info
        convo.lastMessage = content.trim().slice(0, 80);
        convo.lastMessageAt = new Date();
        convo.lastSenderId = req.user._id;

        // Increment unread for all OTHER participants
        convo.participants.forEach(participantId => {
            if (participantId.toString() !== req.user._id.toString()) {
                const current = convo.unreadCounts.get(participantId.toString()) || 0;
                convo.unreadCounts.set(participantId.toString(), current + 1);
            }
        });

        await convo.save();

        res.status(201).json({ success: true, message: populated });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── Send message with file attachment ──────────────────────────────────────
exports.sendMessageWithFile = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { content = '' } = req.body;

        const convo = await Conversation.findOne({
            _id: conversationId,
            participants: req.user._id
        });
        if (!convo) return res.status(403).json({ success: false, message: 'Access denied' });

        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        const fileUrl = `/uploads/messages/${req.file.filename}`;
        const mime = req.file.mimetype;
        const msgType = mime.startsWith('image/') ? 'image'
            : mime.startsWith('video/') ? 'video'
            : 'file';

        const message = await Message.create({
            conversation: conversationId,
            sender: req.user._id,
            content: content.trim() || req.file.originalname,
            messageType: msgType,
            fileUrl,
            fileName: req.file.originalname,
            mimeType: mime,
            fileSize: req.file.size,
            isReadBy: [req.user._id]
        });

        const populated = await message.populate('sender', 'name avatar');

        const previewText = msgType === 'image' ? '📷 Image'
            : msgType === 'video' ? '🎬 Video'
            : `📎 ${req.file.originalname}`;

        convo.lastMessage = content.trim() || previewText;
        convo.lastMessageAt = new Date();
        convo.lastSenderId = req.user._id;

        convo.participants.forEach(participantId => {
            if (participantId.toString() !== req.user._id.toString()) {
                const current = convo.unreadCounts.get(participantId.toString()) || 0;
                convo.unreadCounts.set(participantId.toString(), current + 1);
            }
        });

        await convo.save();
        res.status(201).json({ success: true, message: populated });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── Send GIF message ─────────────────────────────────────────────────────────
exports.sendGifMessage = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { gifUrl, gifTitle = 'GIF' } = req.body;

        if (!gifUrl) return res.status(400).json({ success: false, message: 'gifUrl is required' });

        const convo = await Conversation.findOne({
            _id: conversationId,
            participants: req.user._id
        });
        if (!convo) return res.status(403).json({ success: false, message: 'Access denied' });

        const message = await Message.create({
            conversation: conversationId,
            sender: req.user._id,
            content: gifTitle,
            messageType: 'gif',
            fileUrl: gifUrl,
            isReadBy: [req.user._id]
        });

        const populated = await message.populate('sender', 'name avatar');

        convo.lastMessage = '🎬 GIF';
        convo.lastMessageAt = new Date();
        convo.lastSenderId = req.user._id;

        convo.participants.forEach(participantId => {
            if (participantId.toString() !== req.user._id.toString()) {
                const current = convo.unreadCounts.get(participantId.toString()) || 0;
                convo.unreadCounts.set(participantId.toString(), current + 1);
            }
        });

        await convo.save();
        res.status(201).json({ success: true, message: populated });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── Total unread count (for navbar badge) ────────────────────────────────────
exports.getTotalUnread = async (req, res) => {
    try {
        const conversations = await Conversation.find({ participants: req.user._id });
        const total = conversations.reduce((sum, c) => {
            return sum + (c.unreadCounts?.get(req.user._id.toString()) || 0);
        }, 0);
        res.json({ success: true, unread: total });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── Delete a conversation ────────────────────────────────────────────────────
exports.deleteConversation = async (req, res) => {
    try {
        const convo = await Conversation.findOne({
            _id: req.params.conversationId,
            participants: req.user._id
        });
        if (!convo) return res.status(403).json({ success: false, message: 'Access denied' });
        await Message.deleteMany({ conversation: convo._id });
        await convo.deleteOne();
        res.json({ success: true, message: 'Conversation deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── Edit a message ───────────────────────────────────────────────────────────
exports.editMessage = async (req, res) => {
    try {
        const msg = await Message.findById(req.params.messageId);
        if (!msg) return res.status(404).json({ success: false, message: 'Message not found' });
        if (msg.sender.toString() !== req.user._id.toString())
            return res.status(403).json({ success: false, message: 'Not your message' });
        if (msg.messageType !== 'text')
            return res.status(400).json({ success: false, message: 'Only text messages can be edited' });

        const { content } = req.body;
        if (!content?.trim()) return res.status(400).json({ success: false, message: 'Content required' });

        msg.content = content.trim();
        msg.isEdited = true;
        await msg.save();

        res.json({ success: true, message: msg });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── Delete a single message ──────────────────────────────────────────────────
// mode = 'me' (soft-delete for requester only) | 'everyone' (only sender can; marks deleted for all)
exports.deleteMessage = async (req, res) => {
    try {
        const msg = await Message.findById(req.params.messageId);
        if (!msg) return res.status(404).json({ success: false, message: 'Message not found' });

        const isSender = msg.sender.toString() === req.user._id.toString();
        const { mode } = req.body; // 'me' or 'everyone'

        if (mode === 'everyone') {
            if (!isSender) return res.status(403).json({ success: false, message: 'Only the sender can delete for everyone' });
            msg.isDeletedForEveryone = true;
            msg.content = '';
            await msg.save();
        } else {
            // Delete for me — add user to deletedFor array
            if (!msg.deletedFor.map(id => id.toString()).includes(req.user._id.toString())) {
                msg.deletedFor.push(req.user._id);
            }
            await msg.save();
        }

        res.json({ success: true, messageId: msg._id, mode });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
