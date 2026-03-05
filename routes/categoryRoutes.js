const express = require('express');
const router = express.Router();

const categories = [
    { id: 'technology', name: 'Technology', icon: '💻', count: 0 },
    { id: 'design', name: 'Design & Creative', icon: '🎨', count: 0 },
    { id: 'marketing', name: 'Marketing', icon: '📢', count: 0 },
    { id: 'finance', name: 'Finance & Accounting', icon: '💰', count: 0 },
    { id: 'healthcare', name: 'Healthcare', icon: '🏥', count: 0 },
    { id: 'education', name: 'Education', icon: '📚', count: 0 },
    { id: 'sales', name: 'Sales', icon: '🤝', count: 0 },
    { id: 'engineering', name: 'Engineering', icon: '⚙️', count: 0 },
    { id: 'hr', name: 'Human Resources', icon: '👥', count: 0 },
    { id: 'legal', name: 'Legal', icon: '⚖️', count: 0 },
    { id: 'operations', name: 'Operations', icon: '🔧', count: 0 },
    { id: 'data-science', name: 'Data Science', icon: '📊', count: 0 },
    { id: 'customer-support', name: 'Customer Support', icon: '🎧', count: 0 },
    { id: 'media', name: 'Media & Communications', icon: '🎬', count: 0 }
];

router.get('/', async (req, res) => {
    try {
        const Job = require('../models/Job');
        const categoryCounts = await Job.aggregate([
            { $match: { status: 'active' } },
            { $group: { _id: { $toLower: '$category' }, count: { $sum: 1 } } }
        ]);
        const countMap = {};
        categoryCounts.forEach(c => { if (c._id) countMap[c._id] = c.count; });
        const result = categories.map(cat => ({ ...cat, count: countMap[cat.id.toLowerCase()] || 0 }));
        res.json({ success: true, categories: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
