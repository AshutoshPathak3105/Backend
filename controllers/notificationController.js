const Notification = require('../models/Notification');

/**
 * Helper: create a notification in the DB
 */
const createNotification = async (recipientId, senderId, type, title, message, link = '', meta = {}) => {
    try {
        return await Notification.create({ recipient: recipientId, sender: senderId, type, title, message, link, meta });
    } catch (err) {
        console.error('[Notification] Failed to create:', err.message);
        return null;
    }
};
exports.createNotification = createNotification;

// @desc Get current user's notifications
exports.getMyNotifications = async (req, res) => {
    try {
        const { page = 1, limit = 20, unreadOnly } = req.query;
        const query = { recipient: req.user._id };
        if (unreadOnly === 'true') query.isRead = false;

        const skip = (Number(page) - 1) * Number(limit);
        const [notifications, total, unreadCount] = await Promise.all([
            Notification.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit))
                .populate('sender', 'name avatar'),
            Notification.countDocuments(query),
            Notification.countDocuments({ recipient: req.user._id, isRead: false })
        ]);

        res.json({ success: true, notifications, total, unreadCount, totalPages: Math.ceil(total / Number(limit)) });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Mark a notification as read
exports.markRead = async (req, res) => {
    try {
        const notification = await Notification.findOneAndUpdate(
            { _id: req.params.id, recipient: req.user._id },
            { isRead: true },
            { new: true }
        );
        if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });
        res.json({ success: true, notification });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Mark all notifications as read
exports.markAllRead = async (req, res) => {
    try {
        await Notification.updateMany({ recipient: req.user._id, isRead: false }, { isRead: true });
        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Delete a notification
exports.deleteNotification = async (req, res) => {
    try {
        const notification = await Notification.findOneAndDelete({
            _id: req.params.id,
            recipient: req.user._id
        });
        if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });
        res.json({ success: true, message: 'Notification deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Delete all read notifications for current user
exports.clearReadNotifications = async (req, res) => {
    try {
        const result = await Notification.deleteMany({ recipient: req.user._id, isRead: true });
        res.json({ success: true, message: `${result.deletedCount} notifications cleared` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Delete all notifications for current user
exports.deleteAllNotifications = async (req, res) => {
    try {
        await Notification.deleteMany({ recipient: req.user._id });
        res.json({ success: true, message: 'All notifications deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Export helper so other controllers can use it
exports.createNotification = createNotification;
