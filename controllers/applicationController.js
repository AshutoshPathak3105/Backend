const Application = require('../models/Application');
const Job = require('../models/Job');
const User = require('../models/User');
const { sendApplicationStatusEmail, sendInterviewScheduledEmail, sendNewApplicationEmail } = require('../utils/emailService');
const { createNotification } = require('./notificationController');

// @desc Apply for a job
exports.applyJob = async (req, res) => {
    try {
        const { jobId, coverLetter } = req.body;

        if (!jobId) {
            return res.status(400).json({ success: false, message: 'Job ID is required' });
        }

        const job = await Job.findById(jobId).populate('company', 'name');
        if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
        if (job.status !== 'active') return res.status(400).json({ success: false, message: 'This job is no longer accepting applications' });

        // Check application deadline
        if (job.applicationDeadline && new Date(job.applicationDeadline) < new Date()) {
            return res.status(400).json({ success: false, message: 'Application deadline has passed' });
        }

        const existing = await Application.findOne({ job: jobId, applicant: req.user._id });
        if (existing) return res.status(400).json({ success: false, message: 'You have already applied for this job' });

        // Get full applicant details (including resume) — auth middleware doesn't populate resume
        const applicant = await User.findById(req.user._id).select('name email resume resumeName skills');

        const application = await Application.create({
            job: jobId,
            applicant: req.user._id,
            company: job.company._id || job.company,
            coverLetter: coverLetter || '',
            resume: applicant.resume,
            resumeName: applicant.resumeName,
            timeline: [{ status: 'pending', note: 'Application submitted' }]
        });

        // Atomic increment — avoids race conditions under concurrent requests
        await Job.findByIdAndUpdate(jobId, { $inc: { applicationsCount: 1 } });

        // Notify employer (non-blocking)
        try {
            const postedByUser = await User.findById(job.postedBy).select('name email');
            if (postedByUser) {
                sendNewApplicationEmail(postedByUser, applicant, job).catch(() => { });
                createNotification(
                    job.postedBy,
                    req.user._id,
                    'new_application',
                    'New Application Received',
                    `${applicant.name} applied for ${job.title}`,
                    '/applications',
                    { jobId: job._id, applicationId: application._id }
                ).catch(() => { });
            }
        } catch (_) { }

        res.status(201).json({ success: true, message: 'Application submitted successfully', application });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Get my applications (jobseeker)
exports.getMyApplications = async (req, res) => {
    try {
        const applications = await Application.find({ applicant: req.user._id })
            .populate('job', 'title type location salary status isFeatured applicationDeadline')
            .populate('company', 'name logo location industry isVerified')
            .sort({ createdAt: -1 });
        res.json({ success: true, applications });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Get applications for a specific job (employer)
exports.getJobApplications = async (req, res) => {
    try {
        const job = await Job.findById(req.params.jobId);
        if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
        if (job.postedBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Not authorized to view these applications' });
        }
        const applications = await Application.find({ job: req.params.jobId })
            .populate('applicant', 'name email avatar phone location skills experience education resume resumeName linkedIn github portfolio')
            .sort({ aiMatchScore: -1, createdAt: -1 });
        res.json({ success: true, applications });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Update application status (employer)
exports.updateApplicationStatus = async (req, res) => {
    try {
        const { status, notes, interviewDate, interviewType, feedback } = req.body;
        const validStatuses = ['pending', 'reviewing', 'shortlisted', 'interview', 'offered', 'rejected', 'withdrawn'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status value' });
        }

        const application = await Application.findById(req.params.id)
            .populate('applicant', 'name email')
            .populate('job', 'title')
            .populate('company', 'name');

        if (!application) return res.status(404).json({ success: false, message: 'Application not found' });

        application.status = status;
        if (notes !== undefined) application.notes = notes;
        if (interviewDate) application.interviewDate = interviewDate;
        if (interviewType) application.interviewType = interviewType;
        if (feedback !== undefined) application.feedback = feedback;
        application.timeline.push({ status, note: notes || `Status changed to ${status}` });
        await application.save();

        // Notify applicant via email + in-app (non-blocking)
        if (application.applicant?.email) {
            // Use rich interview email when scheduling an interview with a date
            if (status === 'interview' && application.interviewDate) {
                sendInterviewScheduledEmail(
                    application.applicant,
                    application.job,
                    application.company,
                    application.interviewDate,
                    application.interviewType,
                    notes
                ).catch(() => { });
            } else {
                sendApplicationStatusEmail(
                    application.applicant,
                    application.job,
                    application.company,
                    status
                ).catch(() => { });
            }

            const notifType = status === 'interview' ? 'interview_scheduled' : 'application_status';
            const statusLabels = {
                reviewing: 'Your application is being reviewed',
                shortlisted: '⭐ You have been shortlisted!',
                interview: '🎯 Interview Scheduled!',
                offered: '🎉 You received a job offer!',
                rejected: 'Application status update'
            };
            const notifTitle = statusLabels[status] || 'Application Update';
            const interviewDetail = (status === 'interview' && application.interviewDate)
                ? ` — ${new Date(application.interviewDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`
                : '';
            createNotification(
                application.applicant._id,
                req.user._id,
                notifType,
                notifTitle,
                `Your application for ${application.job?.title} at ${application.company?.name}${interviewDetail}`,
                '/applications',
                { applicationId: application._id, status, interviewDate: application.interviewDate, interviewType: application.interviewType }
            ).catch(() => { });
        }

        res.json({ success: true, message: 'Application status updated', application });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Withdraw application (jobseeker)
exports.withdrawApplication = async (req, res) => {
    try {
        const application = await Application.findById(req.params.id);
        if (!application) return res.status(404).json({ success: false, message: 'Application not found' });
        if (application.applicant.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }
        if (application.status === 'offered') {
            return res.status(400).json({ success: false, message: 'Cannot withdraw an accepted offer. Please contact the employer directly.' });
        }
        application.status = 'withdrawn';
        application.timeline.push({ status: 'withdrawn', note: 'Application withdrawn by applicant' });
        await application.save();
        // Atomically decrement the job's application counter
        await Job.findByIdAndUpdate(application.job, { $inc: { applicationsCount: -1 } });
        res.json({ success: true, message: 'Application withdrawn successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Get all applications for employer's company
exports.getCompanyApplications = async (req, res) => {
    try {
        const Company = require('../models/Company');
        const { status, page = 1, limit = 20 } = req.query;
        const company = await Company.findOne({ owner: req.user._id });
        if (!company) return res.json({ success: true, applications: [], total: 0 });

        const query = { company: company._id };
        if (status) query.status = status;

        const skip = (Number(page) - 1) * Number(limit);
        const total = await Application.countDocuments(query);
        const applications = await Application.find(query)
            .populate('job', 'title type location salary')
            .populate('applicant', 'name email avatar skills phone location experience education resume resumeName linkedIn github portfolio')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit));

        // Sync stale resume paths: if the applicant has re-uploaded their resume after applying,
        // the application record may point to a deleted file. Use the live applicant resume instead
        // and silently update the DB record in the background.
        const staleIds = [];
        const sanitized = applications.map(app => {
            const appObj = app.toObject();
            const liveResume = app.applicant?.resume;
            const liveName = app.applicant?.resumeName;
            if (liveResume && liveResume !== appObj.resume) {
                appObj.resume = liveResume;
                appObj.resumeName = liveName || appObj.resumeName;
                staleIds.push({ id: app._id, resume: liveResume, resumeName: liveName });
            }
            return appObj;
        });

        if (staleIds.length > 0) {
            // Fire-and-forget background update
            Promise.all(
                staleIds.map(({ id, resume, resumeName }) =>
                    Application.findByIdAndUpdate(id, { resume, resumeName })
                )
            ).catch(err => console.error('Resume sync error:', err));
        }

        res.json({ success: true, applications: sanitized, total, totalPages: Math.ceil(total / Number(limit)) });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Mark application as read (employer)
exports.markApplicationRead = async (req, res) => {
    try {
        const application = await Application.findByIdAndUpdate(
            req.params.id,
            { isRead: true },
            { new: true }
        );
        if (!application) return res.status(404).json({ success: false, message: 'Application not found' });
        res.json({ success: true, message: 'Marked as read', application });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Get a single application by ID (employer or applicant)
exports.getApplicationById = async (req, res) => {
    try {
        const application = await Application.findById(req.params.id)
            .populate('applicant', 'name email avatar phone location skills experience education resume resumeName linkedIn github portfolio')
            .populate('job', 'title type location salary')
            .populate('company', 'name logo');

        if (!application) return res.status(404).json({ success: false, message: 'Application not found' });

        const isApplicant = application.applicant._id.toString() === req.user._id.toString();
        const isOwnerOrAdmin = req.user.role === 'admin';

        // Check employer owns the job
        let isEmployerOwner = false;
        if (req.user.role === 'employer') {
            const job = await Job.findById(application.job._id || application.job);
            isEmployerOwner = job && job.postedBy.toString() === req.user._id.toString();
        }

        if (!isApplicant && !isEmployerOwner && !isOwnerOrAdmin) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        res.json({ success: true, application });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Schedule (or reschedule) an interview — dedicated endpoint
exports.scheduleInterview = async (req, res) => {
    try {
        const { interviewDate, interviewType, notes, meetingLink } = req.body;

        if (!interviewDate) {
            return res.status(400).json({ success: false, message: 'Interview date is required' });
        }

        const scheduledAt = new Date(interviewDate);
        if (scheduledAt <= new Date()) {
            return res.status(400).json({ success: false, message: 'Interview date must be in the future' });
        }

        const validTypes = ['phone', 'video', 'in-person', 'technical'];
        if (interviewType && !validTypes.includes(interviewType)) {
            return res.status(400).json({ success: false, message: 'Invalid interview type' });
        }

        const application = await Application.findById(req.params.id)
            .populate('applicant', 'name email')
            .populate('job', 'title')
            .populate('company', 'name');

        if (!application) return res.status(404).json({ success: false, message: 'Application not found' });

        // Only employer who owns the job or admin can schedule
        if (req.user.role !== 'admin') {
            const job = await Job.findById(application.job._id || application.job);
            if (!job || job.postedBy.toString() !== req.user._id.toString()) {
                return res.status(403).json({ success: false, message: 'Not authorized to schedule interviews for this application' });
            }
        }

        if (['rejected', 'withdrawn'].includes(application.status)) {
            return res.status(400).json({ success: false, message: `Cannot schedule interview for a ${application.status} application` });
        }

        const isReschedule = application.status === 'interview' && application.interviewDate;

        application.status = 'interview';
        application.interviewDate = scheduledAt;
        if (interviewType) application.interviewType = interviewType;
        if (notes !== undefined) application.notes = notes;
        if (meetingLink !== undefined) application.meetingLink = meetingLink;

        const timelineNote = isReschedule
            ? `Interview rescheduled to ${scheduledAt.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`
            : `Interview scheduled for ${scheduledAt.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`;

        application.timeline.push({ status: 'interview', note: timelineNote });
        await application.save();

        // Send email + in-app notification (non-blocking)
        const { sendInterviewScheduledEmail } = require('../utils/emailService');
        if (application.applicant?.email) {
            sendInterviewScheduledEmail(
                application.applicant,
                application.job,
                application.company,
                scheduledAt,
                application.interviewType,
                notes,
                meetingLink
            ).catch(() => { });

            createNotification(
                application.applicant._id,
                req.user._id,
                'interview_scheduled',
                isReschedule ? '📅 Interview Rescheduled' : '🎯 Interview Scheduled!',
                `Your interview for ${application.job?.title} at ${application.company?.name} is on ${scheduledAt.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`,
                '/applications',
                {
                    applicationId: application._id,
                    status: 'interview',
                    interviewDate: scheduledAt,
                    interviewType: application.interviewType,
                    meetingLink
                }
            ).catch(() => { });
        }

        res.json({
            success: true,
            message: isReschedule ? 'Interview rescheduled successfully' : 'Interview scheduled successfully',
            application
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Cancel a scheduled interview
exports.cancelInterview = async (req, res) => {
    try {
        const { reason } = req.body;

        const application = await Application.findById(req.params.id)
            .populate('applicant', 'name email')
            .populate('job', 'title')
            .populate('company', 'name');

        if (!application) return res.status(404).json({ success: false, message: 'Application not found' });

        if (req.user.role !== 'admin') {
            const job = await Job.findById(application.job._id || application.job);
            if (!job || job.postedBy.toString() !== req.user._id.toString()) {
                return res.status(403).json({ success: false, message: 'Not authorized' });
            }
        }

        if (application.status !== 'interview') {
            return res.status(400).json({ success: false, message: 'No interview is currently scheduled for this application' });
        }

        application.status = 'shortlisted';
        application.interviewDate = undefined;
        application.interviewType = undefined;
        application.meetingLink = undefined;
        application.timeline.push({ status: 'shortlisted', note: reason ? `Interview cancelled: ${reason}` : 'Interview cancelled by employer' });
        await application.save();

        // Notify applicant (non-blocking)
        if (application.applicant?.email) {
            const { sendApplicationStatusEmail } = require('../utils/emailService');
            sendApplicationStatusEmail(
                application.applicant,
                application.job,
                application.company,
                'shortlisted',
                `Your scheduled interview has been cancelled${reason ? ': ' + reason : ''}. You remain shortlisted.`
            ).catch(() => { });

            createNotification(
                application.applicant._id,
                req.user._id,
                'interview_cancelled',
                '❌ Interview Cancelled',
                `Your interview for ${application.job?.title} at ${application.company?.name} has been cancelled${reason ? ': ' + reason : ''}`,
                '/applications',
                { applicationId: application._id }
            ).catch(() => { });
        }

        res.json({ success: true, message: 'Interview cancelled successfully', application });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
