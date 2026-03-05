const User = require('../models/User');
const Job = require('../models/Job');
const Application = require('../models/Application');
const Company = require('../models/Company');

// @desc Get platform-wide stats
exports.getPlatformStats = async (req, res) => {
    try {
        const [totalUsers, totalJobs, totalApplications, totalCompanies,
            activeJobs, jobseekers, employers, verifiedCompanies] = await Promise.all([
                User.countDocuments(),
                Job.countDocuments(),
                Application.countDocuments(),
                Company.countDocuments({ isActive: true }),
                Job.countDocuments({ status: 'active' }),
                User.countDocuments({ role: 'jobseeker' }),
                User.countDocuments({ role: 'employer' }),
                Company.countDocuments({ isVerified: true })
            ]);

        // Recent registrations (last 7 days)
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const [newUsers, newJobs, newApplications] = await Promise.all([
            User.countDocuments({ createdAt: { $gte: weekAgo } }),
            Job.countDocuments({ createdAt: { $gte: weekAgo } }),
            Application.countDocuments({ createdAt: { $gte: weekAgo } })
        ]);

        // Top categories
        const topCategories = await Job.aggregate([
            { $match: { status: 'active' } },
            { $group: { _id: '$category', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 }
        ]);

        // Application status distribution
        const applicationStats = await Application.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        res.json({
            success: true,
            stats: {
                totalUsers, totalJobs, totalApplications, totalCompanies,
                activeJobs, jobseekers, employers, verifiedCompanies,
                newUsers, newJobs, newApplications,
                topCategories, applicationStats
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Get all users (admin)
exports.getAllUsers = async (req, res) => {
    try {
        const { role, search, page = 1, limit = 20, isActive } = req.query;
        const query = {};
        if (role) query.role = role;
        if (isActive !== undefined) query.isActive = isActive === 'true';
        if (search) query.$or = [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } }
        ];
        const skip = (Number(page) - 1) * Number(limit);
        const total = await User.countDocuments(query);
        const users = await User.find(query)
            .select('-password -resetPasswordToken -resetPasswordExpire')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit));
        res.json({ success: true, users, total, totalPages: Math.ceil(total / Number(limit)) });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Get single user (admin)
exports.getUserById = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password -resetPasswordToken -resetPasswordExpire');
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        const applications = await Application.countDocuments({ applicant: user._id });
        res.json({ success: true, user: { ...user.toObject(), applicationCount: applications } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Toggle user active status (ban/unban)
exports.toggleUserStatus = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        if (user._id.toString() === req.user._id.toString()) {
            return res.status(400).json({ success: false, message: 'Cannot modify your own account' });
        }
        user.isActive = !user.isActive;
        await user.save({ validateBeforeSave: false });
        res.json({ success: true, message: `User ${user.isActive ? 'activated' : 'deactivated'}`, isActive: user.isActive });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Delete user and all associated data (admin)
exports.deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        if (user._id.toString() === req.user._id.toString()) {
            return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
        }
        // Clean up associated data
        await Application.deleteMany({ applicant: user._id });
        await Job.deleteMany({ postedBy: user._id });
        await Company.deleteMany({ owner: user._id });
        await user.deleteOne();
        res.json({ success: true, message: 'User and related data deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Get all jobs (admin - includes all statuses)
exports.getAllJobsAdmin = async (req, res) => {
    try {
        const { status, search, page = 1, limit = 20 } = req.query;
        const query = {};
        if (status) query.status = status;
        if (search) query.$or = [
            { title: { $regex: search, $options: 'i' } },
            { location: { $regex: search, $options: 'i' } }
        ];
        const skip = (Number(page) - 1) * Number(limit);
        const total = await Job.countDocuments(query);
        const jobs = await Job.find(query)
            .populate('company', 'name logo isVerified')
            .populate('postedBy', 'name email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit));
        res.json({ success: true, jobs, total, totalPages: Math.ceil(total / Number(limit)) });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Feature / unfeature a job (admin)
exports.toggleFeatureJob = async (req, res) => {
    try {
        const job = await Job.findById(req.params.id);
        if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
        job.isFeatured = !job.isFeatured;
        await job.save({ validateBeforeSave: false });
        res.json({ success: true, isFeatured: job.isFeatured, message: `Job ${job.isFeatured ? 'featured' : 'unfeatured'}` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Force-close a job (admin)
exports.closeJob = async (req, res) => {
    try {
        const job = await Job.findByIdAndUpdate(req.params.id, { status: 'closed' }, { new: true });
        if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
        res.json({ success: true, message: 'Job closed by admin', job });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Get all companies (admin)
exports.getAllCompaniesAdmin = async (req, res) => {
    try {
        const { search, isVerified, isActive, page = 1, limit = 20 } = req.query;
        const query = {};
        if (search) query.name = { $regex: search, $options: 'i' };
        if (isVerified !== undefined) query.isVerified = isVerified === 'true';
        if (isActive !== undefined) query.isActive = isActive === 'true';
        const skip = (Number(page) - 1) * Number(limit);
        const total = await Company.countDocuments(query);
        const companies = await Company.find(query)
            .populate('owner', 'name email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit));
        res.json({ success: true, companies, total, totalPages: Math.ceil(total / Number(limit)) });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Verify / unverify a company (admin)
exports.toggleVerifyCompany = async (req, res) => {
    try {
        const company = await Company.findById(req.params.id);
        if (!company) return res.status(404).json({ success: false, message: 'Company not found' });
        company.isVerified = !company.isVerified;
        await company.save({ validateBeforeSave: false });
        res.json({ success: true, isVerified: company.isVerified, message: `Company ${company.isVerified ? 'verified' : 'unverified'}` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Toggle company active status (admin)
exports.toggleCompanyStatus = async (req, res) => {
    try {
        const company = await Company.findById(req.params.id);
        if (!company) return res.status(404).json({ success: false, message: 'Company not found' });
        company.isActive = !company.isActive;
        // If deactivating, also close all active jobs
        if (!company.isActive) {
            await Job.updateMany({ company: company._id, status: 'active' }, { status: 'closed' });
        }
        await company.save({ validateBeforeSave: false });
        res.json({ success: true, isActive: company.isActive, message: `Company ${company.isActive ? 'activated' : 'deactivated'}` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Get all applications (admin)
exports.getAllApplicationsAdmin = async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const query = {};
        if (status) query.status = status;
        const skip = (Number(page) - 1) * Number(limit);
        const total = await Application.countDocuments(query);
        const applications = await Application.find(query)
            .populate('job', 'title location type')
            .populate('applicant', 'name email avatar')
            .populate('company', 'name logo')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit));
        res.json({ success: true, applications, total, totalPages: Math.ceil(total / Number(limit)) });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
