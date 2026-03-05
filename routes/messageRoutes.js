const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { handleUpload, uploadMessageFile } = require('../middleware/upload');
const {
    getConversations,
    getOrCreateConversation,
    getMessages,
    sendMessage,
    sendMessageWithFile,
    sendGifMessage,
    getTotalUnread,
    deleteConversation,
    editMessage,
    deleteMessage
} = require('../controllers/messageController');

router.use(protect); // All message routes require auth

router.get('/conversations', getConversations);
router.post('/conversations', getOrCreateConversation);
router.get('/conversations/:conversationId/messages', getMessages);
router.post('/conversations/:conversationId/messages', sendMessage);
router.post('/conversations/:conversationId/messages/file', handleUpload(uploadMessageFile), sendMessageWithFile);
router.post('/conversations/:conversationId/messages/gif', sendGifMessage);
router.delete('/conversations/:conversationId', deleteConversation);
router.get('/unread', getTotalUnread);
router.put('/messages/:messageId', editMessage);
router.delete('/messages/:messageId', deleteMessage);

module.exports = router;
