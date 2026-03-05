const express = require('express');
const router = express.Router();
const {
    getPlatformStats,
    getAllUsers,
    getUserById,
    toggleUserStatus,
    deleteUser,
    getAllJobsAdmin,
    toggleFeatureJob,
    toggleVerifyCompany,
    toggleCompanyStatus,
    closeJob,
    getAllApplicationsAdmin,
    getAllCompaniesAdmin
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

// All admin routes require authentication + admin role
router.use(protect, authorize('admin'));

router.get('/stats', getPlatformStats);

// User management
router.get('/users', getAllUsers);
router.get('/users/:id', getUserById);
router.put('/users/:id/toggle-status', toggleUserStatus);
router.delete('/users/:id', deleteUser);

// Job management
router.get('/jobs', getAllJobsAdmin);
router.put('/jobs/:id/feature', toggleFeatureJob);
router.put('/jobs/:id/close', closeJob);

// Company management
router.get('/companies', getAllCompaniesAdmin);
router.put('/companies/:id/verify', toggleVerifyCompany);
router.put('/companies/:id/toggle-status', toggleCompanyStatus);

// Applications
router.get('/applications', getAllApplicationsAdmin);

module.exports = router;
