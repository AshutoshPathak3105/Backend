const express = require('express');
const router = express.Router();
const { aiChat, analyzeResume, generateCoverLetter, recommendJobsFromResume, verifyAndAnalyzeResume } = require('../controllers/aiController');
const { protect, optionalAuth } = require('../middleware/auth');

router.post('/chat', optionalAuth, aiChat);
router.post('/analyze-resume', protect, analyzeResume);
router.post('/generate-cover-letter', protect, generateCoverLetter);
router.post('/recommend-jobs', protect, recommendJobsFromResume);
router.post('/verify-analyze', protect, verifyAndAnalyzeResume);

module.exports = router;
