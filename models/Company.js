const mongoose = require('mongoose');
const slugify = require('slugify');

const companySchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    logo: { type: String, default: '' },
    coverImage: { type: String, default: '' },
    description: { type: String, default: '' },
    industry: { type: String, required: true },
    size: {
        type: String,
        enum: ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'],
        default: '1-10'
    },
    founded: { type: Number },
    website: { type: String, default: '' },
    email: { type: String },
    phone: { type: String, default: '' },
    location: { type: String, required: true },
    headquarters: { type: String },
    socialLinks: {
        linkedin: { type: String, default: '' },
        twitter: { type: String, default: '' },
        facebook: { type: String, default: '' }
    },
    benefits: [{ type: String }],
    culture: { type: String, default: '' },
    techStack: [{ type: String }],
    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    totalJobs: { type: Number, default: 0 },
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

// Auto-generate slug from company name before saving
companySchema.pre('save', function (next) {
    if (this.isModified('name') || !this.slug) {
        this.slug = slugify(this.name + '-' + this._id.toString().slice(-6), {
            lower: true,
            strict: true
        });
    }
    next();
});

module.exports = mongoose.model('Company', companySchema);
