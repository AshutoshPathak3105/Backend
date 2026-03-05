const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
    applicant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    coverLetter: { type: String, default: '' },
    resume: { type: String },
    resumeName: { type: String },
    status: {
        type: String,
        enum: ['pending', 'reviewing', 'shortlisted', 'interview', 'offered', 'rejected', 'withdrawn'],
        default: 'pending'
    },
    aiMatchScore: { type: Number, default: 0 },
    aiAnalysis: { type: String, default: '' },
    notes: { type: String, default: '' },
    interviewDate: { type: Date },
    interviewType: { type: String, enum: ['phone', 'video', 'in-person', 'technical'] },
    meetingLink: { type: String, default: '' },
    salary: { type: Number },
    feedback: { type: String, default: '' },
    isRead: { type: Boolean, default: false },
    timeline: [{
        status: String,
        note: String,
        date: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

applicationSchema.index({ job: 1, applicant: 1 }, { unique: true });
// Indexes to speed up employer/company application queries
applicationSchema.index({ company: 1, status: 1, createdAt: -1 });
applicationSchema.index({ applicant: 1, createdAt: -1 });

module.exports = mongoose.model('Application', applicationSchema);
