const express = require('express');
const router = express.Router();
const {
    applyJob, getMyApplications, getJobApplications,
    updateApplicationStatus, withdrawApplication,
    getCompanyApplications, markApplicationRead,
    getApplicationById, scheduleInterview, cancelInterview
} = require('../controllers/applicationController');
const { protect, authorize } = require('../middleware/auth');

router.post('/apply', protect, authorize('jobseeker'), applyJob);
router.get('/my-applications', protect, authorize('jobseeker'), getMyApplications);
router.get('/company-applications', protect, authorize('employer', 'admin'), getCompanyApplications);
router.get('/job/:jobId', protect, authorize('employer', 'admin'), getJobApplications);
router.put('/:id/status', protect, authorize('employer', 'admin'), updateApplicationStatus);
router.put('/:id/read', protect, authorize('employer', 'admin'), markApplicationRead);
router.put('/:id/withdraw', protect, authorize('jobseeker'), withdrawApplication);
router.get('/:id', protect, getApplicationById);
router.post('/:id/schedule-interview', protect, authorize('employer', 'admin'), scheduleInterview);
router.delete('/:id/interview', protect, authorize('employer', 'admin'), cancelInterview);

module.exports = router;
