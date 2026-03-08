const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
    sendRequest,
    respondToRequest,
    getRequests,
    getConnections,
    toggleFollow,
    removeConnection,
    browsePeople,
    cancelRequest,
    getFollowers,
    getFollowing
} = require('../controllers/connectionController');

router.get('/', protect, getConnections);
router.get('/requests', protect, getRequests);
router.get('/followers', protect, getFollowers);
router.get('/following', protect, getFollowing);
router.get('/people', protect, browsePeople);
router.post('/request/:id', protect, sendRequest);
router.delete('/request/:id', protect, cancelRequest);
router.put('/respond/:id', protect, respondToRequest);
router.post('/follow/:id', protect, toggleFollow);
router.delete('/:id', protect, removeConnection);

module.exports = router;
