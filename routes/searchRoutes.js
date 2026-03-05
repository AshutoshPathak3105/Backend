const express = require('express');
const router = express.Router();
const Job = require('../models/Job');
const Company = require('../models/Company');
const User = require('../models/User');

// @desc  Global search across jobs, companies, and public user profiles
// @route GET /api/search?q=...
// @access Public
router.get('/', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.trim().length < 2) {
            return res.json({ success: true, jobs: [], companies: [], users: [] });
        }

        const regex = { $regex: q.trim(), $options: 'i' };

        const [jobs, companies, users] = await Promise.all([
            Job.find({
                status: 'active',
                $or: [{ title: regex }, { category: regex }, { location: regex }, { skills: regex }]
            })
                .populate('company', 'name logo')
                .select('title location type salary company slug _id')
                .limit(5)
                .lean(),

            Company.find({
                isActive: true,
                $or: [{ name: regex }, { industry: regex }, { location: regex }]
            })
                .select('name logo industry location slug _id')
                .limit(4)
                .lean(),

            User.find({
                $or: [{ name: regex }, { headline: regex }, { skills: regex }, { email: regex }]
            })
                .select('name avatar headline role email _id')
                .limit(10)
                .lean()
        ]);

        res.json({ success: true, jobs, companies, users });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
