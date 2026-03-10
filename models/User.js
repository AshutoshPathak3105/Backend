const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, minlength: 6 },
    role: { type: String, enum: ['jobseeker', 'employer', 'admin'], default: 'jobseeker' },
    avatar: { type: String, default: '' },
    phone: { type: String, unique: true, sparse: true, trim: true },
    location: { type: String, default: '' },
    bio: { type: String, default: '' },
    headline: { type: String, default: '' },
    website: { type: String, default: '' },
    skills: [{ type: String }],
    experience: [{
        title: String,
        company: String,
        location: String,
        from: Date,
        to: Date,
        current: Boolean,
        description: String
    }],
    achievements: [{
        title: { type: String, required: true },
        issuer: { type: String, default: '' },
        date: { type: Date },
        description: { type: String, default: '' }
    }],
    education: [{
        school: String,
        degree: String,
        fieldOfStudy: String,
        from: Date,
        to: Date,
        current: Boolean,
        description: String
    }],
    resume: { type: String, default: '' },
    resumeName: { type: String, default: '' },
    linkedIn: { type: String, default: '' },
    github: { type: String, default: '' },
    portfolio: { type: String, default: '' },
    savedJobs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Job' }],
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },
    profileCompletion: { type: Number, default: 0 },
    resetPasswordToken: { type: String },
    resetPasswordExpire: { type: Date },
    otp: { type: String },
    otpExpire: { type: Date },
    connections: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    followingCompanies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Company' }],
    views: { type: Number, default: 0 }
}, { timestamps: true });

userSchema.pre('save', async function (next) {
    // Coerce empty phone string → undefined so sparse unique index works correctly
    if (this.phone === '') this.phone = undefined;

    // Hash password if modified
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 12);
    }
    // Auto-recalculate profile completion
    this.profileCompletion = this.calculateProfileCompletion();
    next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.calculateProfileCompletion = function () {
    let score = 0;
    if (this.name) score += 10;
    if (this.email) score += 10;
    if (this.phone) score += 10;
    if (this.location) score += 10;
    if (this.bio) score += 10;
    if (this.skills.length > 0) score += 15;
    if (this.experience.length > 0) score += 15;
    if (this.education.length > 0) score += 10;
    if (this.resume) score += 10;
    return score;
};

// Generate & hash password reset token
userSchema.methods.generatePasswordResetToken = function () {
    const resetToken = crypto.randomBytes(32).toString('hex');
    // Store hashed version in DB
    this.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    this.resetPasswordExpire = Date.now() + 15 * 60 * 1000; // 15 minutes
    return resetToken; // Return plain token for the email link
};

module.exports = mongoose.model('User', userSchema);
