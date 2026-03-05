const express = require('express');
const router = express.Router();
const {
    getStories,
    getMyStory,
    createStory,
    updateStory,
    deleteStory
} = require('../controllers/storyController');
const { protect } = require('../middleware/auth');

router.get('/', getStories);
router.get('/my', protect, getMyStory);
router.post('/', protect, createStory);
router.put('/:id', protect, updateStory);
router.delete('/:id', protect, deleteStory);

module.exports = router;
