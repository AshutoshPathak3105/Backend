require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Job = require('./models/Job');
const Company = require('./models/Company');
const Story = require('./models/Story');
const slugify = require('slugify');

const data = [
    // Tech - India
    {
        name: 'TCS', industry: 'Technology', region: 'India', logo: 'https://logo.clearbit.com/tcs.com', jobs: [
            { title: 'Full Stack Developer', category: 'technology', experience: '2-5 years', salary: { min: 800000, max: 1500000, currency: 'INR' }, location: 'Mumbai, India', skills: ['React', 'Node.js', 'Java'] },
            { title: 'HR Manager', category: 'hr', experience: '5-8 years', salary: { min: 1200000, max: 2000000, currency: 'INR' }, location: 'Chennai, India', skills: ['Recruitment', 'Employee Relations', 'HRIS'] },
            { title: 'Cloud Architect', category: 'technology', experience: '8-12 years', salary: { min: 2500000, max: 4500000, currency: 'INR' }, location: 'Bangalore, India', skills: ['AWS', 'Azure', 'DevOps'] }
        ]
    },
    {
        name: 'Infosys', industry: 'Technology', region: 'India', logo: 'https://logo.clearbit.com/infosys.com', jobs: [
            { title: 'Java Backend Developer', category: 'technology', experience: '3-6 years', salary: { min: 1000000, max: 1800000, currency: 'INR' }, location: 'Pune, India', skills: ['Java', 'Spring Boot', 'Microservices'] },
            { title: 'Sales Executive', category: 'sales', experience: '2-4 years', salary: { min: 600000, max: 1200000, currency: 'INR' }, location: 'Hyderabad, India', skills: ['Lead Generation', 'CRM', 'B2B Sales'] }
        ]
    },
    // Tech - USA
    {
        name: 'Google', industry: 'Technology', region: 'USA', logo: 'https://logo.clearbit.com/google.com', jobs: [
            { title: 'Software Engineer, AI', category: 'technology', region: 'USA', salary: { min: 150000, max: 250000, currency: 'USD' }, location: 'Mountain View, CA', skills: ['Python', 'TensorFlow', 'C++'], experience: '3-7 years' },
            { title: 'HR Business Partner', category: 'hr', region: 'USA', salary: { min: 140000, max: 210000, currency: 'USD' }, location: 'Seattle, WA', skills: ['Strategic HR', 'Talent Management', 'Legal Compliance'], experience: '6-10 years' },
            { title: 'Product Manager', category: 'technology', experience: '5-10 years', salary: { min: 180000, max: 280000, currency: 'USD' }, location: 'New York, NY', skills: ['Strategy', 'Agile', 'Product Lifecycle'] }
        ]
    },
    {
        name: 'Microsoft', industry: 'Technology', region: 'USA', logo: 'https://logo.clearbit.com/microsoft.com', jobs: [
            { title: 'Azure Cloud Engineer', category: 'technology', experience: '4-8 years', salary: { min: 140000, max: 220000, currency: 'USD' }, location: 'Redmond, WA', skills: ['Azure', 'PowerShell', 'Kubernetes'] },
            { title: 'Marketing Communications Lead', category: 'marketing', experience: '7-12 years', salary: { min: 130000, max: 195000, currency: 'USD' }, location: 'Austin, TX', skills: ['Brand Strategy', 'Public Relations', 'Content Marketing'] }
        ]
    },
    // Finance - USA
    {
        name: 'J.P. Morgan', industry: 'Finance', region: 'USA', logo: 'https://logo.clearbit.com/jpmorgan.com', jobs: [
            { title: 'Investment Analyst', category: 'finance', experience: '2-4 years', salary: { min: 100000, max: 160000, currency: 'USD' }, location: 'Chicago, IL', skills: ['Financial Modeling', 'Excel', 'Valuation'] },
            { title: 'Operations Manager', category: 'operations', experience: '5-9 years', salary: { min: 110000, max: 175000, currency: 'USD' }, location: 'Plano, TX', skills: ['Process Improvement', 'Team Leadership', 'Risk Management'] }
        ]
    }
];

const seedEnhanced = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        const admin = await User.findOne({ role: 'admin' });
        if (!admin) {
            console.log('❌ Admin user not found. Run seeder.js first.');
            process.exit(1);
        }

        for (const compData of data) {
            let comp = await Company.findOne({ name: compData.name });
            if (!comp) {
                console.log(`🏢 Creating company: ${compData.name}`);
                const compSlug = slugify(compData.name, { lower: true });
                comp = await Company.create({
                    name: compData.name,
                    slug: compSlug,
                    industry: compData.industry,
                    location: compData.location || compData.region,
                    owner: admin._id,
                    logo: compData.logo,
                    description: `${compData.name} is a global leader in ${compData.industry}. Joining our team means working at the forefront of innovation.`,
                    isActive: true,
                    isVerified: true
                });
            }

            for (const jobData of compData.jobs) {
                const existingJob = await Job.findOne({ title: jobData.title, company: comp._id });
                if (!existingJob) {
                    console.log(`💼 Adding job: ${jobData.title} at ${compData.name}`);
                    const jobSlug = slugify(jobData.title + '-' + compData.name + '-' + Date.now(), { lower: true });
                    await Job.create({
                        ...jobData,
                        slug: jobSlug,
                        company: comp._id,
                        postedBy: admin._id,
                        type: 'full-time',
                        description: `We are looking for a ${jobData.title} to join our world-class team. Requires ${jobData.experience}. Skills: ${jobData.skills.join(', ')}.`,
                        requirements: [`Minimum ${jobData.experience}`, ...jobData.skills.map(s => `Proficiency in ${s}`)],
                        status: 'active'
                    });
                }
            }
        }

        // Seed Sample Success Stories
        const existingStories = await Story.countDocuments();
        if (existingStories === 0) {
            console.log('📖 Adding sample success stories...');
            await Story.create([
                {
                    user: admin._id,
                    name: 'Ashutosh Pathak',
                    role: 'Full Stack Developer',
                    story: 'Job Sarthi helped me transition from a junior role to a lead developer at a top tech firm. The AI matching was spot on!',
                    rating: 5,
                    avatar: 'AP',
                    isApproved: true
                },
                {
                    user: admin._id,
                    name: 'Priya Sharma',
                    role: 'Product Manager',
                    story: 'The interview prep tools are incredible. I felt so confident during my final rounds thanks to the AI guidelines.',
                    rating: 5,
                    avatar: 'PS',
                    isApproved: true
                },
                {
                    user: admin._id,
                    name: 'Michael Chen',
                    role: 'Data Scientist',
                    story: 'Found a remote role that matches my lifestyle perfectly. The platform is clean, fast, and actually shows relevant jobs.',
                    rating: 5,
                    avatar: 'MC',
                    isApproved: true
                }
            ]);
        }

        console.log('✅ Enhanced data seeding completed!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error seeding enhanced data:', err);
        process.exit(1);
    }
};

seedEnhanced();
