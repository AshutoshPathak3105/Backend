const express = require('express');
const router = express.Router();
const {
    createCompany, getCompany, getMyCompany,
    updateCompany, deleteCompany, getAllCompanies, getCompanyJobs,
    toggleFollowCompany
} = require('../controllers/companyController');
const { protect, authorize } = require('../middleware/auth');
const { uploadLogo, handleUpload } = require('../middleware/upload');

router.get('/', getAllCompanies);
router.get('/my-company', protect, authorize('employer', 'admin'), getMyCompany);
router.get('/:id', getCompany);
router.get('/:id/jobs', getCompanyJobs);
router.post('/', protect, authorize('employer', 'admin'), handleUpload(uploadLogo), createCompany);
router.put('/', protect, authorize('employer', 'admin'), handleUpload(uploadLogo), updateCompany);
router.delete('/', protect, authorize('employer', 'admin'), deleteCompany);
router.post('/:id/follow', protect, toggleFollowCompany);

module.exports = router;
