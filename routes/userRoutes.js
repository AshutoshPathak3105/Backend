const express = require('express');
const router = express.Router();
const {
    getProfile, updateProfile,
    addExperience, updateExperience, deleteExperience,
    addAchievement, deleteAchievement,
    addEducation, updateEducation, deleteEducation,
    uploadResume, deleteResume,
    getSavedJobs,
    getDashboardStats, getEmployerDashboardStats,
    getRecentActivity, deleteAccount
} = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const { uploadAvatar, uploadResume: multerResume, handleUpload } = require('../middleware/upload');

// Profile
router.get('/profile/:id', getProfile);
router.get('/profile', protect, getProfile);
router.put('/profile', protect, handleUpload(uploadAvatar), updateProfile);

// Experience
router.post('/experience', protect, addExperience);
router.put('/experience/:expId', protect, updateExperience);
router.delete('/experience/:expId', protect, deleteExperience);

// Achievements
router.post('/achievements', protect, addAchievement);
router.delete('/achievements/:achId', protect, deleteAchievement);

// Education
router.post('/education', protect, addEducation);
router.put('/education/:eduId', protect, updateEducation);
router.delete('/education/:eduId', protect, deleteEducation);

// Resume
router.post('/resume', protect, handleUpload(multerResume), uploadResume);
router.delete('/resume', protect, deleteResume);

// Saved jobs & dashboard
router.get('/saved-jobs', protect, getSavedJobs);
router.get('/dashboard-stats', protect, getDashboardStats);
router.get('/employer-stats', protect, getEmployerDashboardStats);
router.get('/recent-activity', protect, getRecentActivity);
router.delete('/account', protect, deleteAccount);

module.exports = router;
