const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    slug: { type: String, unique: true },
    description: { type: String, required: true },
    requirements: [{ type: String }],
    responsibilities: [{ type: String }],
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    category: { type: String, required: true },
    type: {
        type: String,
        enum: ['full-time', 'part-time', 'contract', 'internship', 'remote', 'freelance'],
        required: true
    },
    level: {
        type: String,
        enum: ['entry', 'mid', 'senior', 'lead', 'executive'],
        default: 'mid'
    },
    location: { type: String, required: true },
    isRemote: { type: Boolean, default: false },
    salary: {
        min: { type: Number },
        max: { type: Number },
        currency: { type: String, default: 'INR' },
        period: { type: String, enum: ['hourly', 'monthly', 'yearly'], default: 'yearly' },
        isNegotiable: { type: Boolean, default: false }
    },
    skills: [{ type: String }],
    benefits: [{ type: String }],
    vacancies: { type: Number, default: 1, min: 1 },
    educationRequirement: { type: String, default: '' },
    applicationDeadline: { type: Date },
    status: { type: String, enum: ['active', 'closed', 'draft', 'paused'], default: 'active' },
    views: { type: Number, default: 0 },
    applicationsCount: { type: Number, default: 0 },
    isFeatured: { type: Boolean, default: false },
    isUrgent: { type: Boolean, default: false },
    tags: [{ type: String }],
    aiScore: { type: Number, default: 0 },
    aiSummary: { type: String, default: '' }
}, { timestamps: true });

jobSchema.index({ title: 'text', description: 'text', skills: 'text' });
jobSchema.index({ category: 1, type: 1, location: 1 });
jobSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Job', jobSchema);
