const Job = require('../models/Job');
const Company = require('../models/Company');
const Application = require('../models/Application');
const slugify = require('slugify');
const { createNotification } = require('./notificationController');

// @desc Get all jobs with filters
exports.getJobs = async (req, res) => {
    try {
        const { search, category, type, level, location, minSalary, maxSalary, isRemote, isFeatured, sort, page = 1, limit = 12 } = req.query;
        const query = { status: 'active' };
        // Full-text search across relevant fields ($or within search term)
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { skills: { $regex: search, $options: 'i' } },
                { tags: { $regex: search, $options: 'i' } }
            ];
        }

        // Location filter is independent from search (AND, not OR)
        if (location) {
            query.location = { $regex: location, $options: 'i' };
        }

        if (category) {
            // Escape regex special chars, then allow both slug (data-science) and
            // display-name (Data Science) to match stored category values
            const escapedCat = category.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
            // Build alternate: replace escaped hyphens with "[-\s]?" to match
            // "data-science", "data science", "datascience", "Data Science" etc.
            const flexPattern = escapedCat.replace(/\\-/g, '[-\\s]?');
            query.category = { $regex: flexPattern, $options: 'i' };
        }
        if (type) query.type = type;
        if (level) query.level = level;

        // isRemote: 'true' → remote only, 'false' → on-site only
        if (isRemote === 'true') query.isRemote = true;
        if (isRemote === 'false') query.isRemote = false;
        if (isFeatured === 'true') query.isFeatured = true;

        // Salary range filter
        if (minSalary) query['salary.min'] = { $gte: Number(minSalary) };
        if (maxSalary) query['salary.max'] = { $lte: Number(maxSalary) };

        let sortOption = { createdAt: -1 };
        if (sort === 'salary') sortOption = { 'salary.max': -1 };
        if (sort === 'views') sortOption = { views: -1 };
        if (sort === 'applications') sortOption = { applicationsCount: -1 };
        if (sort === 'featured') sortOption = { isFeatured: -1, createdAt: -1 };

        const skip = (Number(page) - 1) * Number(limit);
        const total = await Job.countDocuments(query);
        const jobs = await Job.find(query)
            .populate('company', 'name logo location industry isVerified rating')
            .populate('postedBy', 'name avatar')
            .sort(sortOption)
            .skip(skip)
            .limit(Number(limit));

        res.json({
            success: true,
            count: jobs.length,
            total,
            totalPages: Math.ceil(total / Number(limit)),
            currentPage: Number(page),
            jobs
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Get single job
exports.getJob = async (req, res) => {
    try {
        const job = await Job.findById(req.params.id)
            .populate('company', 'name logo location industry website description size founded benefits culture techStack isVerified rating reviewCount')
            .populate('postedBy', 'name avatar');
        if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
        job.views += 1;
        await job.save({ validateBeforeSave: false });
        res.json({ success: true, job });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Create job
exports.createJob = async (req, res) => {
    try {
        const company = await Company.findOne({ owner: req.user._id });
        if (!company) return res.status(400).json({ success: false, message: 'Please create a company profile first' });

        const { title, description, category, type, level, location } = req.body;
        if (!title || !description || !category || !type || !location) {
            return res.status(400).json({ success: false, message: 'Title, description, category, type, and location are required' });
        }

        const slug = slugify(title + '-' + Date.now(), { lower: true });
        const job = await Job.create({ ...req.body, company: company._id, postedBy: req.user._id, slug });
        company.totalJobs += 1;
        await company.save({ validateBeforeSave: false });

        // Notify the employer that their job was posted successfully
        await createNotification(
            req.user._id,
            'job_posted',
            '🎉 Job Posted Successfully!',
            `Your job "${title}" at ${company.name} is now live and visible to candidates.`,
            `/jobs/${job._id}`
        );

        // Notify all job seekers about the new job posting
        const User = require('../models/User');
        const jobSeekers = await User.find({ role: 'jobseeker', isActive: true }).select('_id').limit(500);
        const notifPromises = jobSeekers.map(seeker =>
            createNotification(
                seeker._id,
                'job_posted',
                `💼 New job: ${title}`,
                `${company.name} just posted a new role: "${title}" in ${location}.`,
                `/jobs/${job._id}`
            )
        );
        await Promise.allSettled(notifPromises);

        res.status(201).json({ success: true, message: 'Job posted successfully', job });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Update job
exports.updateJob = async (req, res) => {
    try {
        let job = await Job.findById(req.params.id);
        if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
        if (job.postedBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Not authorized to update this job' });
        }
        job = await Job.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        res.json({ success: true, message: 'Job updated successfully', job });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Delete job
exports.deleteJob = async (req, res) => {
    try {
        const job = await Job.findById(req.params.id);
        if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
        if (job.postedBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Not authorized to delete this job' });
        }
        // Also delete all applications for this job
        await Application.deleteMany({ job: job._id });
        await job.deleteOne();
        // Decrement company totalJobs
        await Company.findByIdAndUpdate(job.company, { $inc: { totalJobs: -1 } });
        res.json({ success: true, message: 'Job and associated applications deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Get employer's jobs (with application count)
exports.getMyJobs = async (req, res) => {
    try {
        const company = await Company.findOne({ owner: req.user._id });
        if (!company) return res.json({ success: true, jobs: [] });
        const jobs = await Job.find({ company: company._id }).sort({ createdAt: -1 });
        res.json({ success: true, jobs });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Get featured jobs
exports.getFeaturedJobs = async (req, res) => {
    try {
        let jobs = await Job.find({ status: 'active', isFeatured: true })
            .populate('company', 'name logo location industry isVerified')
            .sort({ createdAt: -1 })
            .limit(6)
            .lean();
        // Fallback: if no featured jobs exist, return latest active jobs
        if (!jobs || jobs.length === 0) {
            jobs = await Job.find({ status: 'active' })
                .populate('company', 'name logo location industry isVerified')
                .sort({ createdAt: -1 })
                .limit(6)
                .lean();
        }
        res.json({ success: true, jobs });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Save/unsave job (toggle)
exports.toggleSaveJob = async (req, res) => {
    try {
        const User = require('../models/User');
        const user = await User.findById(req.user._id);
        const jobId = req.params.id;

        // Verify job exists
        const job = await Job.findById(jobId);
        if (!job) return res.status(404).json({ success: false, message: 'Job not found' });

        const isSaved = user.savedJobs.map(id => id.toString()).includes(jobId);
        if (isSaved) {
            user.savedJobs = user.savedJobs.filter(id => id.toString() !== jobId);
        } else {
            user.savedJobs.push(jobId);
        }
        await user.save({ validateBeforeSave: false });
        res.json({ success: true, isSaved: !isSaved, message: isSaved ? 'Job removed from saved' : 'Job saved successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Get platform-wide job stats (for homepage)
exports.getJobStats = async (req, res) => {
    try {
        const User = require('../models/User');
        const [totalJobs, totalCompanies, totalApplications, totalUsers] = await Promise.all([
            Job.countDocuments({ status: 'active' }),
            Company.countDocuments({ isActive: true }),
            Application.countDocuments(),
            User.countDocuments({ role: 'jobseeker' })
        ]);
        const categoryStats = await Job.aggregate([
            { $match: { status: 'active' } },
            { $group: { _id: '$category', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 8 }
        ]);
        res.json({ success: true, stats: { totalJobs, totalCompanies, totalApplications, totalUsers, categoryStats } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Toggle job status (active/paused) — employer only
exports.toggleJobStatus = async (req, res) => {
    try {
        const job = await Job.findById(req.params.id);
        if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
        if (job.postedBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }
        job.status = job.status === 'active' ? 'paused' : 'active';
        await job.save({ validateBeforeSave: false });
        res.json({ success: true, status: job.status, message: `Job ${job.status === 'active' ? 'activated' : 'paused'}` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
