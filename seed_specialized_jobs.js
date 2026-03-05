/**
 * Seed Specialized Jobs for Customer Support and Media
 * Run: node seed_specialized_jobs.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const slugify = require('slugify');
const User = require('./models/User');
const Job = require('./models/Job');
const Company = require('./models/Company');

const COMPANIES = [
    { name: 'Google', industry: 'Technology', logo: 'https://logo.clearbit.com/google.com', location: 'Mountain View, CA' },
    { name: 'Amazon', industry: 'Technology', logo: 'https://logo.clearbit.com/amazon.com', location: 'Seattle, WA' },
    { name: 'Meta', industry: 'Technology', logo: 'https://logo.clearbit.com/meta.com', location: 'Menlo Park, CA' },
    { name: 'Netflix', industry: 'Technology', logo: 'https://logo.clearbit.com/netflix.com', location: 'Los Gatos, CA' },
    { name: 'HubSpot', industry: 'Marketing', logo: 'https://logo.clearbit.com/hubspot.com', location: 'Boston, MA' },
    { name: 'Salesforce', industry: 'Technology', logo: 'https://logo.clearbit.com/salesforce.com', location: 'San Francisco, CA' },
    { name: 'Airbnb', industry: 'Technology', logo: 'https://logo.clearbit.com/airbnb.com', location: 'San Francisco, CA' },
    { name: 'Disney', industry: 'Entertainment', logo: 'https://logo.clearbit.com/disney.com', location: 'Burbank, CA' },
    { name: 'Warner Bros', industry: 'Media', logo: 'https://logo.clearbit.com/warnerbros.com', location: 'Burbank, CA' },
    { name: 'NBCUniversal', industry: 'Media', logo: 'https://logo.clearbit.com/nbcuniversal.com', location: 'New York, NY' }
];

const NEW_JOBS = [
    // ─── CUSTOMER SUPPORT (25 Jobs) ───────────────────────────────
    { title: 'Customer Success Manager', category: 'customer-support', company: 'HubSpot', experience: '3-5 years', salary: { min: 80000, max: 120000, currency: 'USD' }, location: 'Remote', skills: ['CRM', 'Relationship Management', 'Retention'], type: 'full-time' },
    { title: 'Technical Support Engineer', category: 'customer-support', company: 'Google', experience: '2-4 years', salary: { min: 90000, max: 130000, currency: 'USD' }, location: 'Mountain View, CA', skills: ['Troubleshooting', 'Linux', 'SQL'], type: 'full-time' },
    { title: 'Customer Support Advocate', category: 'customer-support', company: 'Airbnb', experience: '1-3 years', salary: { min: 50000, max: 75000, currency: 'USD' }, location: 'Remote', skills: ['Empathy', 'Case Management', 'Zendesk'], type: 'full-time' },
    { title: 'Head of Customer Experience', category: 'customer-support', company: 'Salesforce', experience: '8-12 years', salary: { min: 160000, max: 240000, currency: 'USD' }, location: 'San Francisco, CA', skills: ['CX Strategy', 'Leadership', 'NPS'], type: 'full-time' },
    { title: 'Cloud Support Associate', category: 'customer-support', company: 'Amazon', experience: '0-2 years', salary: { min: 70000, max: 100000, currency: 'USD' }, location: 'Seattle, WA', skills: ['AWS', 'Networking', 'Communication'], type: 'full-time' },
    { title: 'Help Desk Specialist', category: 'customer-support', company: 'Microsoft', experience: '1-3 years', salary: { min: 60000, max: 90000, currency: 'USD' }, location: 'Redmond, WA', skills: ['Active Directory', 'IT Support', 'Mac/Windows'], type: 'full-time' },
    { title: 'Support Operations Specialist', category: 'customer-support', company: 'HubSpot', experience: '2-5 years', salary: { min: 85000, max: 125000, currency: 'USD' }, location: 'Boston, MA', skills: ['Workforce Management', 'Analytics', 'SLA'], type: 'full-time' },
    { title: 'Multilingual Support Hero (Spanish)', category: 'customer-support', company: 'Meta', experience: '1-4 years', salary: { min: 65000, max: 95000, currency: 'USD' }, location: 'Austin, TX', skills: ['Spanish Proficiency', 'User Support', 'Moderation'], type: 'full-time' },
    { title: 'Billing & Account Specialist', category: 'customer-support', company: 'Netflix', experience: '2-4 years', salary: { min: 75000, max: 110000, currency: 'USD' }, location: 'Remote', skills: ['Billing Systems', 'Conflict Resolution', 'Detail Oriented'], type: 'full-time' },
    { title: 'Tier 3 Technical Support', category: 'customer-support', company: 'Salesforce', experience: '4-7 years', salary: { min: 110000, max: 160000, currency: 'USD' }, location: 'Remote', skills: ['Debugging', 'APIs', 'Network Protocols'], type: 'full-time' },
    { title: 'Live Chat Representative', category: 'customer-support', company: 'Airbnb', experience: '0-2 years', salary: { min: 45000, max: 65000, currency: 'USD' }, location: 'Manila, PH', skills: ['Typing Speed', 'Multitasking', 'Friendly Tone'], type: 'full-time' },
    { title: 'Community Support Moderator', category: 'customer-support', company: 'Meta', experience: '1-3 years', salary: { min: 55000, max: 85000, currency: 'USD' }, location: 'Menlo Park, CA', skills: ['Policy Knowledge', 'Safety', 'Online Ethics'], type: 'full-time' },
    { title: 'Customer Education Specialist', category: 'customer-support', company: 'HubSpot', experience: '3-6 years', salary: { min: 95000, max: 140000, currency: 'USD' }, location: 'Remote', skills: ['Training', 'Webinars', 'LMS'], type: 'full-time' },
    { title: 'VIP Account Manager', category: 'customer-support', company: 'Disney', experience: '4-7 years', salary: { min: 100000, max: 150000, currency: 'USD' }, location: 'Orlando, FL', skills: ['High-Net-Worth Support', 'Hospitality', 'Discretion'], type: 'full-time' },
    { title: 'Solutions Architect - Support', category: 'customer-support', company: 'Google', experience: '5-9 years', salary: { min: 150000, max: 220000, currency: 'USD' }, location: 'London, UK', skills: ['Custom Solutions', 'Implementation', 'Enterprise Cloud'], type: 'full-time' },
    { title: 'Service Desk Lead', category: 'customer-support', company: 'Amazon', experience: '5-8 years', salary: { min: 105000, max: 155000, currency: 'USD' }, location: 'Berlin, DE', skills: ['ITIL', 'Leadership', 'Vendor Management'], type: 'full-time' },
    { title: 'Digital Support Specialist', category: 'customer-support', company: 'Apple', experience: '2-4 years', salary: { min: 80000, max: 120000, currency: 'USD' }, location: 'Cupertino, CA', skills: ['iOS', 'iCloud', 'User Guidance'], type: 'full-time' },
    { title: 'Quality Assurance - Support', category: 'customer-support', company: 'Salesforce', experience: '3-5 years', salary: { min: 90000, max: 130000, currency: 'USD' }, location: 'Remote', skills: ['Call Monitoring', 'Feedback', 'Compliance'], type: 'full-time' },
    { title: 'CX Data Analyst', category: 'customer-support', company: 'Netflix', experience: '2-5 years', salary: { min: 110000, max: 170000, currency: 'USD' }, location: 'Los Gatos, CA', skills: ['SQL', 'Tableau', 'User Sentiment'], type: 'full-time' },
    { title: 'Escalations Manager', category: 'customer-support', company: 'Uber', experience: '4-8 years', salary: { min: 120000, max: 180000, currency: 'USD' }, location: 'Chicago, IL', skills: ['Crisis Management', 'Executive Communication', 'Problem Solving'], type: 'full-time' },
    { title: 'Customer Feedback Lead', category: 'customer-support', company: 'Google', experience: '5-9 years', salary: { min: 140000, max: 200000, currency: 'USD' }, location: 'Mountain View, CA', skills: ['Voice of Customer', 'Product Alignment', 'Survey Design'], type: 'full-time' },
    { title: 'Global Support Lead', category: 'customer-support', company: 'Amazon', experience: '8-12 years', salary: { min: 180000, max: 250000, currency: 'USD' }, location: 'Dublin, IE', skills: ['International Ops', 'Scaling Support', 'Strategy'], type: 'full-time' },
    { title: 'Trust & Safety Agent', category: 'customer-support', company: 'Meta', experience: '1-3 years', salary: { min: 60000, max: 90000, currency: 'USD' }, location: 'Remote', skills: ['Safety Compliance', 'Content Review', 'Empathy'], type: 'full-time' },
    { title: 'Partner Support Manager', category: 'customer-support', company: 'Microsoft', experience: '4-7 years', salary: { min: 115000, max: 165000, currency: 'USD' }, location: 'Seattle, WA', skills: ['B2B Support', 'Ecosystem Management', 'Project Management'], type: 'full-time' },
    { title: 'Support Intern', category: 'customer-support', company: 'HubSpot', experience: '0-1 years', salary: { min: 45000, max: 60000, currency: 'USD' }, location: 'Boston, MA', skills: ['Ambition', 'Learning Mindset', 'Teamwork'], type: 'internship' },

    // ─── MEDIA & COMMUNICATIONS (25 Jobs) ─────────────────────────
    { title: 'Senior Video Editor', category: 'media', company: 'Netflix', experience: '5-8 years', salary: { min: 120000, max: 180000, currency: 'USD' }, location: 'Los Gatos, CA', skills: ['Davinci Resolve', 'Premiere Pro', 'Storytelling'], type: 'full-time' },
    { title: 'Podcast Producer', category: 'media', company: 'Warner Bros', experience: '3-6 years', salary: { min: 90000, max: 140000, currency: 'USD' }, location: 'New York, NY', skills: ['Audio Engineering', 'Scripwriting', 'Interviewing'], type: 'full-time' },
    { title: 'Communications Strategist', category: 'media', company: 'Google', experience: '4-7 years', salary: { min: 110000, max: 170000, currency: 'USD' }, location: 'Mountain View, CA', skills: ['Public Relations', 'Internal Comms', 'Media Relations'], type: 'full-time' },
    { title: 'Social Media Content Creator', category: 'media', company: 'Netflix', experience: '1-4 years', salary: { min: 70000, max: 110000, currency: 'USD' }, location: 'Remote', skills: ['Short-form Video', 'CapCut', 'Cultural Trends'], type: 'full-time' },
    { title: 'Motion Graphics Artist', category: 'media', company: 'Disney', experience: '3-6 years', salary: { min: 100000, max: 150000, currency: 'USD' }, location: 'Burbank, CA', skills: ['After Effects', 'Cinema 4D', 'Animation'], type: 'full-time' },
    { title: 'Global PR Director', category: 'media', company: 'Apple', experience: '10-15 years', salary: { min: 250000, max: 350000, currency: 'USD' }, location: 'Cupertino, CA', skills: ['Strategic Comms', 'Global Media', 'Leadership'], type: 'full-time' },
    { title: 'Digital Content Lead', category: 'media', company: 'NBCUniversal', experience: '6-9 years', salary: { min: 130000, max: 190000, currency: 'USD' }, location: 'New York, NY', skills: ['Content Lifecycle', 'CMS', 'SEO'], type: 'full-time' },
    { title: 'Journalism Intern', category: 'media', company: 'Warner Bros', experience: '0-1 years', salary: { min: 50000, max: 70000, currency: 'USD' }, location: 'Remote', skills: ['Writing', 'Fact Checking', 'Curiosity'], type: 'internship' },
    { title: 'Corporate Comms Manager', category: 'media', company: 'Meta', experience: '5-8 years', salary: { min: 140000, max: 210000, currency: 'USD' }, location: 'Menlo Park, CA', skills: ['Executive Comms', 'Crisis PR', 'Messaging'], type: 'full-time' },
    { title: 'Video Producer - Marketing', category: 'media', company: 'HubSpot', experience: '3-6 years', salary: { min: 95000, max: 145000, currency: 'USD' }, location: 'Boston, MA', skills: ['Camerawork', 'Lighting', 'Directing'], type: 'full-time' },
    { title: 'Audio Engineer', category: 'media', company: 'Warner Bros', experience: '4-7 years', salary: { min: 100000, max: 160000, currency: 'USD' }, location: 'Burbank, CA', skills: ['Mixing', 'Mastering', 'Pro Tools'], type: 'full-time' },
    { title: 'Publicity Coordinator', category: 'media', company: 'NBCUniversal', experience: '2-4 years', salary: { min: 75000, max: 110000, currency: 'USD' }, location: 'Universal City, CA', skills: ['Press Kits', 'Events', 'Public Relations'], type: 'full-time' },
    { title: 'Creative Writer - Ad Agency', category: 'media', company: 'Disney', experience: '3-6 years', salary: { min: 90000, max: 140000, currency: 'USD' }, location: 'Remote', skills: ['Copywriting', 'Ad Campaigns', 'Creative Direction'], type: 'full-time' },
    { title: 'Multimedia Journalist', category: 'media', company: 'Warner Bros', experience: '2-5 years', salary: { min: 85000, max: 125000, currency: 'USD' }, location: 'Washington, DC', skills: ['Reporting', 'Photography', 'Live Streaming'], type: 'full-time' },
    { title: 'Internal Comms Lead', category: 'media', company: 'Google', experience: '6-10 years', salary: { min: 150000, max: 220000, currency: 'USD' }, location: 'Mountain View, CA', skills: ['Employee Engagement', 'Culture', 'Town Halls'], type: 'full-time' },
    { title: 'Production Assistant', category: 'media', company: 'Netflix', experience: '0-2 years', salary: { min: 55000, max: 80000, currency: 'USD' }, location: 'Seoul, KR', skills: ['Coordination', 'Organization', 'Translation'], type: 'full-time' },
    { title: 'Media Analyst', category: 'media', company: 'Meta', experience: '3-6 years', salary: { min: 110000, max: 165000, currency: 'USD' }, location: 'Remote', skills: ['Social Analytics', 'Sentiment Analysis', 'Power BI'], type: 'full-time' },
    { title: 'Documentary Director', category: 'media', company: 'Disney', experience: '7-12 years', salary: { min: 160000, max: 250000, currency: 'USD' }, location: 'Remote', skills: ['Direction', 'Field Work', 'Visual Storytelling'], type: 'contract' },
    { title: 'Communications Specialist', category: 'media', company: 'Salesforce', experience: '2-5 years', salary: { min: 90000, max: 130000, currency: 'USD' }, location: 'San Francisco, CA', skills: ['Email Comms', 'Slack Strategy', 'Writing'], type: 'full-time' },
    { title: 'Head of Media Relations', category: 'media', company: 'Airbnb', experience: '12-18 years', salary: { min: 280000, max: 400000, currency: 'USD' }, location: 'San Francisco, CA', skills: ['Media Strategy', 'Spokesperson', 'Network'], type: 'full-time' },
    { title: 'Content Editor - Entertainment', category: 'media', company: 'NBCUniversal', experience: '3-6 years', salary: { min: 85000, max: 125000, currency: 'USD' }, location: 'New York, NY', skills: ['Copy Editing', 'CMS', 'Pop Culture'], type: 'full-time' },
    { title: 'Brand Storyteller', category: 'media', company: 'Netflix', experience: '4-8 years', salary: { min: 130000, max: 190000, currency: 'USD' }, location: 'Amsterdam, NL', skills: ['Narrative Design', 'Marketing Comms', 'Branding'], type: 'full-time' },
    { title: 'Live Broadcast Engineer', category: 'media', company: 'Warner Bros', experience: '5-9 years', salary: { min: 120000, max: 175000, currency: 'USD' }, location: 'Atlanta, GA', skills: ['Broadcast Tech', 'Satellite', 'AV Setup'], type: 'full-time' },
    { title: 'Media Ethics Lead', category: 'media', company: 'Google', experience: '10-15 years', salary: { min: 200000, max: 300000, currency: 'USD' }, location: 'London, UK', skills: ['Ethics', 'Policy', 'Trust'], type: 'full-time' },
    { title: 'Junior Graphic Designer', category: 'media', company: 'HubSpot', experience: '1-3 years', salary: { min: 65000, max: 95000, currency: 'USD' }, location: 'Remote', skills: ['Figma', 'Illustrator', 'Design'], type: 'full-time' }
];

const seed = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        const admin = await User.findOne({ role: 'admin' });
        if (!admin) {
            console.log('❌ No admin user found. Run seeder.js first.');
            process.exit(1);
        }

        // Ensure all companies exist
        const companyMap = {};
        for (const c of COMPANIES) {
            let comp = await Company.findOne({ name: c.name });
            if (!comp) {
                const slug = slugify(c.name + '-' + Date.now(), { lower: true });
                comp = await Company.create({
                    name: c.name, slug, industry: c.industry,
                    location: c.location, owner: admin._id, logo: c.logo,
                    description: `${c.name} — a global leader in ${c.industry}. Join us to build the future.`,
                    isActive: true, isVerified: true
                });
                console.log(`🏢 Created company: ${c.name}`);
            }
            companyMap[c.name] = comp._id;
        }

        let added = 0, skipped = 0;
        for (const job of NEW_JOBS) {
            const compId = companyMap[job.company];
            if (!compId) { console.log(`⚠️  Company not found: ${job.company}`); continue; }

            // Check if job with this title and company already exists
            const exists = await Job.findOne({ title: job.title, company: compId });
            if (exists) { skipped++; continue; }

            const slug = slugify(`${job.title}-${job.company}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, { lower: true });
            await Job.create({
                title: job.title, slug, category: job.category,
                company: compId, postedBy: admin._id,
                experience: job.experience, salary: job.salary,
                location: job.location, skills: job.skills,
                type: job.type || 'full-time',
                description: `Join us as a ${job.title} at ${job.company}! We are looking for someone with ${job.experience} of experience and proficiency in ${job.skills.join(', ')}.`,
                requirements: [`${job.experience} of relevant experience`, ...job.skills.map(s => `Proficiency in ${s}`)],
                status: 'active'
            });
            added++;
        }

        console.log(`\n✅ Done! Added: ${added} new specialized jobs, Skipped: ${skipped}`);

        // Final Breakdown
        const cats = ['customer-support', 'media'];
        for (const cat of cats) {
            const count = await Job.countDocuments({ category: cat, status: 'active' });
            console.log(`   ${cat.padEnd(20)} → ${count} jobs`);
        }

        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
};

seed();
