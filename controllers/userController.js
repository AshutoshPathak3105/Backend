const User = require('../models/User');
const Application = require('../models/Application');
const Job = require('../models/Job');
const Company = require('../models/Company');
const ConnectionRequest = require('../models/ConnectionRequest');
const path = require('path');
const fs = require('fs');

// @desc Get user profile
exports.getProfile = async (req, res) => {
    try {
        const userId = req.params.id || req.user._id;
        const user = await User.findById(userId).select('-password');
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const profileData = user.toObject();

        // If authenticated, check relationship status
        if (req.user) {
            const currentUserId = req.user._id;

            // Check if following
            profileData.isFollowing = user.followers.some(f => f.toString() === currentUserId.toString());

            // Check connection status
            if (user.connections.some(c => c.toString() === currentUserId.toString())) {
                profileData.connectionStatus = 'connected';
            } else {
                const pendingRequest = await ConnectionRequest.findOne({
                    $or: [
                        { sender: currentUserId, recipient: userId },
                        { sender: userId, recipient: currentUserId }
                    ],
                    status: 'pending'
                });

                if (pendingRequest) {
                    profileData.connectionStatus = pendingRequest.sender.toString() === currentUserId.toString()
                        ? 'sent'
                        : 'received';
                    profileData.requestId = pendingRequest._id;
                } else {
                    profileData.connectionStatus = 'none';
                }
            }
        }

        res.json({ success: true, user: profileData });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Update user profile
exports.updateProfile = async (req, res) => {
    try {
        const { name, phone, location, bio, headline, website, skills, linkedIn, github, portfolio, removeAvatar } = req.body;
        const user = await User.findById(req.user._id);
        
        if (removeAvatar === true || removeAvatar === 'true') {
            if (user.avatar && user.avatar.startsWith('/uploads/')) {
                const oldPath = path.join(__dirname, '..', user.avatar);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }
            user.avatar = '';
        }

        if (name) user.name = name;
        if (phone !== undefined) user.phone = phone;
        if (location !== undefined) user.location = location;
        if (bio !== undefined) user.bio = bio;
        if (headline !== undefined) user.headline = headline;
        if (website !== undefined) user.website = website;
        if (skills !== undefined) {
            user.skills = Array.isArray(skills) ? skills : skills.split(',').map(s => s.trim()).filter(Boolean);
        }
        if (linkedIn !== undefined) user.linkedIn = linkedIn;
        if (github !== undefined) user.github = github;
        if (portfolio !== undefined) user.portfolio = portfolio;

        // Handle avatar upload if file provided
        if (req.file) {
            // Remove old avatar file if exists
            if (user.avatar && user.avatar.startsWith('/uploads/')) {
                const oldPath = path.join(__dirname, '..', user.avatar);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }
            user.avatar = `/uploads/avatars/${req.file.filename}`;
        }

        user.profileCompletion = user.calculateProfileCompletion();
        await user.save({ validateBeforeSave: false });
        res.json({ success: true, message: 'Profile updated successfully', user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Add experience
exports.addExperience = async (req, res) => {
    try {
        const { title, company, location, from, to, current, description } = req.body;
        if (!title || !company || !from) {
            return res.status(400).json({ success: false, message: 'Title, company, and from date are required' });
        }
        const user = await User.findById(req.user._id);

        // Clean up empty strings for Date fields to avoid Mongoose cast errors
        const expData = {
            title,
            company,
            location,
            from: from || undefined,
            to: (current || !to) ? undefined : to,
            current: current || false,
            description
        };

        user.experience.unshift(expData);
        user.profileCompletion = user.calculateProfileCompletion();
        await user.save({ validateBeforeSave: false });
        res.json({ success: true, message: 'Experience added', experience: user.experience });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Update experience
exports.updateExperience = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const expIndex = user.experience.findIndex(exp => exp._id.toString() === req.params.expId);
        if (expIndex === -1) return res.status(404).json({ success: false, message: 'Experience not found' });

        // Clean up dates if they are empty strings
        const updates = { ...req.body };
        if (updates.from === '') updates.from = undefined;
        if (updates.to === '' || updates.current) updates.to = undefined;

        user.experience[expIndex] = { ...user.experience[expIndex]._doc, ...updates };
        await user.save({ validateBeforeSave: false });
        res.json({ success: true, message: 'Experience updated', experience: user.experience });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Delete experience
exports.deleteExperience = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        user.experience = user.experience.filter(exp => exp._id.toString() !== req.params.expId);
        await user.save({ validateBeforeSave: false });
        res.json({ success: true, message: 'Experience removed', experience: user.experience });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Add achievement
exports.addAchievement = async (req, res) => {
    try {
        const { title, issuer, date, description } = req.body;
        if (!title) return res.status(400).json({ success: false, message: 'Title is required' });
        const user = await User.findById(req.user._id);
        user.achievements.unshift({ title, issuer, date: date || undefined, description });
        await user.save({ validateBeforeSave: false });
        res.json({ success: true, message: 'Achievement added', achievements: user.achievements });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Delete achievement
exports.deleteAchievement = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        user.achievements = user.achievements.filter(a => a._id.toString() !== req.params.achId);
        await user.save({ validateBeforeSave: false });
        res.json({ success: true, message: 'Achievement removed', achievements: user.achievements });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Add education
exports.addEducation = async (req, res) => {
    try {
        const { school, degree, fieldOfStudy, from, to, current, description } = req.body;
        if (!school || !from) {
            return res.status(400).json({ success: false, message: 'School and start date are required' });
        }
        const user = await User.findById(req.user._id);

        // Sanitize dates
        const eduData = {
            school,
            degree,
            fieldOfStudy,
            from: from || undefined,
            to: (current || !to) ? undefined : to,
            current: current || false,
            description
        };

        user.education.unshift(eduData);
        user.profileCompletion = user.calculateProfileCompletion();
        await user.save({ validateBeforeSave: false });
        res.json({ success: true, message: 'Education added', education: user.education });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Update education
exports.updateEducation = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const eduIndex = user.education.findIndex(edu => edu._id.toString() === req.params.eduId);
        if (eduIndex === -1) return res.status(404).json({ success: false, message: 'Education not found' });

        const updates = { ...req.body };
        if (updates.from === '') updates.from = undefined;
        if (updates.to === '' || updates.current) updates.to = undefined;

        user.education[eduIndex] = { ...user.education[eduIndex]._doc, ...updates };
        await user.save({ validateBeforeSave: false });
        res.json({ success: true, message: 'Education updated', education: user.education });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Delete education
exports.deleteEducation = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        user.education = user.education.filter(edu => edu._id.toString() !== req.params.eduId);
        await user.save({ validateBeforeSave: false });
        res.json({ success: true, message: 'Education removed', education: user.education });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Upload resume (file via multer)
exports.uploadResume = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (req.file) {
            // File upload via multer
            if (user.resume && user.resume.startsWith('/uploads/')) {
                const oldPath = path.join(__dirname, '..', user.resume);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }
            user.resume = `/uploads/resumes/${req.file.filename}`;
            user.resumeName = req.file.originalname;

            // ── Sync with existing applications ─────────────────────────────
            // When a user updates their profile resume, we ensure all their 
            // open applications point to the NEW file, since the OLD file 
            // was just deleted from the disk above.
            try {
                await Application.updateMany(
                    { applicant: user._id },
                    { resume: user.resume, resumeName: user.resumeName }
                );
            } catch (err) {
                console.error('Failed to sync resume with applications:', err);
            }
            // ────────────────────────────────────────────────────────────────
        } else if (req.body.resume) {
            // Base64 fallback
            user.resume = req.body.resume;
            user.resumeName = req.body.resumeName || 'resume.pdf';
        } else {
            return res.status(400).json({ success: false, message: 'No resume file provided' });
        }

        user.profileCompletion = user.calculateProfileCompletion();
        await user.save({ validateBeforeSave: false });
        res.json({ success: true, message: 'Resume uploaded successfully', resumeName: user.resumeName });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Delete resume
exports.deleteResume = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (user.resume && user.resume.startsWith('/uploads/')) {
            const filePath = path.join(__dirname, '..', user.resume);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
        user.resume = '';
        user.resumeName = '';
        user.profileCompletion = user.calculateProfileCompletion();
        await user.save({ validateBeforeSave: false });
        res.json({ success: true, message: 'Resume deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Get saved jobs
exports.getSavedJobs = async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .populate({ path: 'savedJobs', populate: { path: 'company', select: 'name logo location industry isVerified' } });
        res.json({ success: true, savedJobs: user.savedJobs });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Get dashboard stats (works for both jobseeker and employer)
exports.getDashboardStats = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (req.user.role === 'employer' || req.user.role === 'admin') {
            const company = await Company.findOne({ owner: req.user._id });

            // If Admin has no company, show platform stats instead of 0s
            if (!company && req.user.role === 'admin') {
                const [activeJobs, totalApplications, totalCompanies, jobseekers] = await Promise.all([
                    Job.countDocuments({ status: 'active' }),
                    Application.countDocuments(),
                    Company.countDocuments({ isActive: true }),
                    User.countDocuments({ role: 'jobseeker' })
                ]);
                return res.json({
                    success: true,
                    stats: {
                        activeJobs,
                        totalApplications,
                        shortlisted: totalCompanies, // Reuse slots for admin
                        hired: jobseekers,
                        newApplicationsToday: 0,
                        isAdmin: true
                    }
                });
            }

            if (!company) {
                return res.json({
                    success: true,
                    stats: { activeJobs: 0, totalApplications: 0, shortlisted: 0, hired: 0, newApplicationsToday: 0 }
                });
            }

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const [activeJobs, totalApplications, shortlisted, hired, newApplicationsToday, totalViews] = await Promise.all([
                Job.countDocuments({ company: company._id, status: 'active' }),
                Application.countDocuments({ company: company._id }),
                Application.countDocuments({ company: company._id, status: 'shortlisted' }),
                Application.countDocuments({ company: company._id, status: 'offered' }),
                Application.countDocuments({ company: company._id, createdAt: { $gte: today } }),
                Job.aggregate([
                    { $match: { company: company._id } },
                    { $group: { _id: null, totalViews: { $sum: '$views' } } }
                ])
            ]);
            const views = totalViews.length > 0 ? totalViews[0].totalViews : 0;
            return res.json({ success: true, stats: { activeJobs, totalApplications, shortlisted, hired, newApplicationsToday, totalJobViews: views } });
        }

        // Jobseeker stats
        const [totalApplications, pending, shortlisted, interviews, offered] = await Promise.all([
            Application.countDocuments({ applicant: req.user._id }),
            Application.countDocuments({ applicant: req.user._id, status: 'pending' }),
            Application.countDocuments({ applicant: req.user._id, status: 'shortlisted' }),
            Application.countDocuments({
                applicant: req.user._id,
                status: 'interview',
                interviewDate: { $gt: new Date(Date.now() - 2 * 60 * 60 * 1000) } // Only count future or recent (last 2h) interviews
            }),
            Application.countDocuments({ applicant: req.user._id, status: 'offered' })
        ]);
        res.json({
            success: true,
            stats: {
                totalApplications, pending, shortlisted, interviews, offered,
                savedJobs: (user.savedJobs || []).length,
                profileCompletion: user.profileCompletion || 0,
                profileViews: user.views || 0,
                connections: (user.connections || []).length
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Get employer dashboard stats
exports.getEmployerDashboardStats = async (req, res) => {
    try {
        const company = await Company.findOne({ owner: req.user._id });
        if (!company) {
            return res.json({ success: true, stats: { activeJobs: 0, totalApplications: 0, shortlisted: 0, hired: 0 } });
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const [activeJobs, totalApplications, shortlisted, hired, newApplicationsToday, totalViews] = await Promise.all([
            Job.countDocuments({ company: company._id, status: 'active' }),
            Application.countDocuments({ company: company._id }),
            Application.countDocuments({ company: company._id, status: 'shortlisted' }),
            Application.countDocuments({ company: company._id, status: 'offered' }),
            Application.countDocuments({ company: company._id, createdAt: { $gte: today } }),
            Job.aggregate([
                { $match: { company: company._id } },
                { $group: { _id: null, totalViews: { $sum: '$views' } } }
            ])
        ]);
        const views = totalViews.length > 0 ? totalViews[0].totalViews : 0;
        res.json({ success: true, stats: { activeJobs, totalApplications, shortlisted, hired, newApplicationsToday, totalJobViews: views } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Get recent application activity for dashboard
exports.getRecentActivity = async (req, res) => {
    try {
        let activity = [];
        if (req.user.role === 'jobseeker') {
            const apps = await Application.find({ applicant: req.user._id })
                .populate('job', 'title')
                .populate('company', 'name logo')
                .sort({ updatedAt: -1 })
                .limit(5);
            activity = apps.map(app => ({
                type: 'application',
                message: `Application for ${app.job?.title} at ${app.company?.name} is ${app.status}`,
                status: app.status,
                date: app.updatedAt
            }));
        } else {
            const company = await Company.findOne({ owner: req.user._id });
            if (company) {
                const apps = await Application.find({ company: company._id })
                    .populate('job', 'title')
                    .populate('applicant', 'name avatar')
                    .sort({ createdAt: -1 })
                    .limit(5);
                activity = apps.map(app => ({
                    type: 'new_application',
                    message: `${app.applicant?.name} applied for ${app.job?.title}`,
                    status: app.status,
                    date: app.createdAt,
                    applicantAvatar: app.applicant?.avatar
                }));
            }
        }
        res.json({ success: true, activity });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Delete own account and all associated data
exports.deleteAccount = async (req, res) => {
    try {
        const { password } = req.body;
        if (!password) {
            return res.status(400).json({ success: false, message: 'Password is required to delete your account' });
        }
        const user = await User.findById(req.user._id).select('+password');
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Incorrect password' });
        }

        // Delete uploaded files (avatar, resume)
        if (user.avatar && user.avatar.startsWith('/uploads/')) {
            const avatarPath = path.join(__dirname, '..', user.avatar);
            if (fs.existsSync(avatarPath)) fs.unlinkSync(avatarPath);
        }
        if (user.resume && user.resume.url && user.resume.url.startsWith('/uploads/')) {
            const resumePath = path.join(__dirname, '..', user.resume.url);
            if (fs.existsSync(resumePath)) fs.unlinkSync(resumePath);
        }

        // Delete associated data
        await Application.deleteMany({ applicant: user._id });
        await Job.updateMany({}, { $pull: { savedBy: user._id } });

        await User.findByIdAndDelete(user._id);

        res.json({ success: true, message: 'Account deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
