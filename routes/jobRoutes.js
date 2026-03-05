const express = require('express');
const router = express.Router();
const {
    getJobs, getJob, createJob, updateJob, deleteJob,
    getMyJobs, getFeaturedJobs, toggleSaveJob, getJobStats,
    toggleJobStatus
} = require('../controllers/jobController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', getJobs);
router.get('/featured', getFeaturedJobs);
router.get('/stats', getJobStats);
router.get('/my-jobs', protect, authorize('employer', 'admin'), getMyJobs);
router.get('/:id', getJob);
router.post('/', protect, authorize('employer', 'admin'), createJob);
router.put('/:id', protect, authorize('employer', 'admin'), updateJob);
router.put('/:id/toggle-status', protect, authorize('employer', 'admin'), toggleJobStatus);
router.delete('/:id', protect, authorize('employer', 'admin'), deleteJob);
router.post('/:id/save', protect, toggleSaveJob);

module.exports = router;
