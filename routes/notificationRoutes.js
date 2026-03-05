const express = require('express');
const router = express.Router();
const {
    getMyNotifications,
    markRead,
    markAllRead,
    deleteNotification,
    clearReadNotifications
} = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');

router.use(protect); // All notification routes require authentication

router.get('/', getMyNotifications);
router.put('/mark-all-read', markAllRead);
router.delete('/clear-read', clearReadNotifications);
router.put('/:id/read', markRead);
router.delete('/:id', deleteNotification);

module.exports = router;
