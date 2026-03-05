const Company = require('../models/Company');
const Job = require('../models/Job');
const Application = require('../models/Application');
const slugify = require('slugify');
const path = require('path');
const fs = require('fs');

// @desc Create company profile
exports.createCompany = async (req, res) => {
    try {
        const existing = await Company.findOne({ owner: req.user._id });
        if (existing) return res.status(400).json({ success: false, message: 'You already have a company profile' });

        const slug = slugify(req.body.name + '-' + Date.now(), { lower: true });
        const companyData = { ...req.body, owner: req.user._id, slug };

        // Handle logo upload
        if (req.file) {
            companyData.logo = `/uploads/logos/${req.file.filename}`;
        }

        const company = await Company.create(companyData);
        res.status(201).json({ success: true, message: 'Company created successfully', company });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Get company by ID
exports.getCompany = async (req, res) => {
    try {
        const company = await Company.findById(req.params.id).populate('owner', 'name email avatar');
        if (!company) return res.status(404).json({ success: false, message: 'Company not found' });
        res.json({ success: true, company });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Get my company
exports.getMyCompany = async (req, res) => {
    try {
        const company = await Company.findOne({ owner: req.user._id });
        res.json({ success: true, company: company || null });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Update company
exports.updateCompany = async (req, res) => {
    try {
        const company = await Company.findOne({ owner: req.user._id });
        if (!company) return res.status(404).json({ success: false, message: 'Company not found' });

        // Handle logo upload
        if (req.file) {
            // Remove old logo
            if (company.logo && company.logo.startsWith('/uploads/')) {
                const oldPath = path.join(__dirname, '..', company.logo);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }
            req.body.logo = `/uploads/logos/${req.file.filename}`;
        }

        // Handle socialLinks as JSON string from form-data
        if (req.body.socialLinks && typeof req.body.socialLinks === 'string') {
            try { req.body.socialLinks = JSON.parse(req.body.socialLinks); } catch (e) { /* ignore */ }
        }

        // Handle arrays sent as comma-separated strings
        if (req.body.benefits && typeof req.body.benefits === 'string') {
            req.body.benefits = req.body.benefits.split(',').map(s => s.trim()).filter(Boolean);
        }
        if (req.body.techStack && typeof req.body.techStack === 'string') {
            req.body.techStack = req.body.techStack.split(',').map(s => s.trim()).filter(Boolean);
        }

        const updatedCompany = await Company.findOneAndUpdate(
            { owner: req.user._id },
            req.body,
            { new: true, runValidators: true }
        );
        res.json({ success: true, message: 'Company updated successfully', company: updatedCompany });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Delete company
exports.deleteCompany = async (req, res) => {
    try {
        const company = await Company.findOne({ owner: req.user._id });
        if (!company) return res.status(404).json({ success: false, message: 'Company not found' });

        // Soft delete — deactivate all company jobs
        await Job.updateMany({ company: company._id }, { status: 'closed' });

        // Remove logo file
        if (company.logo && company.logo.startsWith('/uploads/')) {
            const logoPath = path.join(__dirname, '..', company.logo);
            if (fs.existsSync(logoPath)) fs.unlinkSync(logoPath);
        }

        await company.deleteOne();
        res.json({ success: true, message: 'Company profile deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Get all companies with filters
exports.getAllCompanies = async (req, res) => {
    try {
        const { search, industry, size, page = 1, limit = 12 } = req.query;
        const query = { isActive: true };
        if (search) query.name = { $regex: search, $options: 'i' };
        if (industry) query.industry = industry;
        if (size) query.size = size;
        const skip = (Number(page) - 1) * Number(limit);
        const total = await Company.countDocuments(query);
        const companies = await Company.find(query)
            .sort({ isVerified: -1, totalJobs: -1 })
            .skip(skip)
            .limit(Number(limit));
        res.json({ success: true, companies, total, totalPages: Math.ceil(total / Number(limit)) });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Get company jobs
exports.getCompanyJobs = async (req, res) => {
    try {
        const company = await Company.findById(req.params.id);
        if (!company) return res.status(404).json({ success: false, message: 'Company not found' });
        const jobs = await Job.find({ company: company._id, status: 'active' })
            .sort({ createdAt: -1 });
        res.json({ success: true, jobs, total: jobs.length });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
