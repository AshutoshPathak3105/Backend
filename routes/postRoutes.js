const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
    upload, getPosts, createPost, deletePost,
    toggleLike, addComment, deleteComment, sharePost, viewPost
} = require('../controllers/postController');

router.get('/', protect, getPosts);
router.post('/', protect, upload.array('media', 5), createPost);
router.delete('/:id', protect, deletePost);
router.put('/:id/like', protect, toggleLike);
router.post('/:id/comment', protect, addComment);
router.delete('/:id/comment/:cid', protect, deleteComment);
router.put('/:id/share', protect, sharePost);
router.put('/:id/view', protect, viewPost);

module.exports = router;
