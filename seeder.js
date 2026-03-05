/**
 * Database Seeder for Job Portal
 * Run: node seeder.js        → to seed data
 * Run: node seeder.js -d     → to destroy all data
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config();

const User = require('./models/User');
const Job = require('./models/Job');
const Company = require('./models/Company');
const Application = require('./models/Application');

const seedData = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ MongoDB Connected for seeding');

        // Clear existing data
        await Promise.all([
            User.deleteMany(),
            Job.deleteMany(),
            Company.deleteMany(),
            Application.deleteMany()
        ]);
        console.log('🗑️  Cleared existing data');

        // Create admin user
        const adminUser = await User.create({
            name: 'Admin User',
            email: 'admin@jobportal.com',
            password: 'Admin@123',
            role: 'admin',
            isVerified: true,
            profileCompletion: 100
        });

        // Create employer users
        const employer1 = await User.create({
            name: 'Tech Corp HR',
            email: 'hr@techcorp.com',
            password: 'Employer@123',
            role: 'employer',
            isVerified: true,
            profileCompletion: 80
        });

        const employer2 = await User.create({
            name: 'Design Studio HR',
            email: 'hr@designstudio.com',
            password: 'Employer@123',
            role: 'employer',
            isVerified: true,
            profileCompletion: 75
        });

        // Create jobseeker users
        const jobseeker1 = await User.create({
            name: 'John Developer',
            email: 'john@example.com',
            password: 'User@123',
            role: 'jobseeker',
            phone: '+1-555-0101',
            location: 'San Francisco, CA',
            bio: 'Full-stack developer with 3 years of experience in React and Node.js',
            skills: ['React', 'Node.js', 'MongoDB', 'TypeScript', 'AWS'],
            linkedIn: 'https://linkedin.com/in/johndev',
            github: 'https://github.com/johndev',
            experience: [{
                title: 'Frontend Developer',
                company: 'StartupXYZ',
                location: 'Remote',
                from: new Date('2021-01-01'),
                current: true,
                description: 'Built responsive React applications'
            }],
            education: [{
                school: 'UC Berkeley',
                degree: 'B.S.',
                fieldOfStudy: 'Computer Science',
                from: new Date('2017-08-01'),
                to: new Date('2021-05-01')
            }],
            profileCompletion: 90
        });

        const jobseeker2 = await User.create({
            name: 'Jane Designer',
            email: 'jane@example.com',
            password: 'User@123',
            role: 'jobseeker',
            phone: '+1-555-0102',
            location: 'New York, NY',
            bio: 'UI/UX Designer passionate about creating beautiful digital experiences',
            skills: ['Figma', 'Adobe XD', 'Sketch', 'CSS', 'HTML'],
            profileCompletion: 80
        });

        console.log('👥 Users created');

        // Create companies
        const company1 = await Company.create({
            name: 'TechCorp Solutions',
            slug: 'techcorp-solutions',
            owner: employer1._id,
            description: 'Leading technology company specializing in cloud solutions and enterprise software.',
            industry: 'Technology',
            size: '201-500',
            founded: 2010,
            website: 'https://techcorp.example.com',
            email: 'hr@techcorp.com',
            phone: '+1-555-1000',
            location: 'San Francisco, CA',
            headquarters: 'San Francisco, CA',
            benefits: ['Health Insurance', 'Remote Work', '401k', 'Stock Options', 'Unlimited PTO'],
            culture: 'We foster a culture of innovation, collaboration, and continuous learning.',
            techStack: ['React', 'Node.js', 'AWS', 'PostgreSQL', 'Docker', 'Kubernetes'],
            isVerified: true,
            isActive: true,
            rating: 4.5,
            reviewCount: 127
        });

        const company2 = await Company.create({
            name: 'Creative Design Studio',
            slug: 'creative-design-studio',
            owner: employer2._id,
            description: 'Award-winning design agency creating world-class digital experiences.',
            industry: 'Design',
            size: '11-50',
            founded: 2015,
            website: 'https://designstudio.example.com',
            email: 'hr@designstudio.com',
            location: 'New York, NY',
            benefits: ['Flexible Hours', 'Remote Work', 'Creative Budget', 'Health Insurance'],
            culture: 'Creative freedom meets professional excellence.',
            techStack: ['Figma', 'Adobe Suite', 'Webflow', 'React'],
            isVerified: true,
            isActive: true,
            rating: 4.8,
            reviewCount: 45
        });

        console.log('🏢 Companies created');

        // Update employer users with company reference done (no ref field needed in user)
        employer1.profileCompletion = 85;
        employer2.profileCompletion = 80;
        await employer1.save({ validateBeforeSave: false });
        await employer2.save({ validateBeforeSave: false });

        // Create jobs
        const jobs = await Job.insertMany([
            {
                title: 'Senior React Developer',
                slug: 'senior-react-developer-' + Date.now(),
                description: 'We are looking for a talented Senior React Developer to join our growing team. You will be responsible for building and maintaining high-quality web applications.',
                requirements: ['5+ years of React experience', 'Strong TypeScript skills', 'Experience with Redux or similar state management', 'Knowledge of testing frameworks'],
                responsibilities: ['Develop and maintain React applications', 'Code review and mentoring junior developers', 'Collaborate with design and product teams', 'Optimize application performance'],
                company: company1._id,
                postedBy: employer1._id,
                category: 'technology',
                type: 'full-time',
                level: 'senior',
                location: 'San Francisco, CA',
                isRemote: true,
                salary: { min: 120000, max: 160000, currency: 'USD', period: 'yearly' },
                skills: ['React', 'TypeScript', 'Redux', 'Node.js', 'Jest'],
                benefits: ['Health Insurance', 'Remote Work', 'Stock Options', '401k'],
                status: 'active',
                isFeatured: true,
                isUrgent: true,
                views: 324,
                applicationsCount: 45
            },
            {
                title: 'Full Stack Node.js Engineer',
                slug: 'fullstack-nodejs-engineer-' + (Date.now() + 1),
                description: 'Join our backend team to build scalable APIs and microservices using Node.js and MongoDB.',
                requirements: ['3+ years Node.js experience', 'MongoDB expertise', 'RESTful API design', 'Docker knowledge'],
                responsibilities: ['Design and implement RESTful APIs', 'Database schema design', 'Write unit and integration tests', 'Deploy and monitor services on AWS'],
                company: company1._id,
                postedBy: employer1._id,
                category: 'technology',
                type: 'full-time',
                level: 'mid',
                location: 'San Francisco, CA',
                isRemote: false,
                salary: { min: 90000, max: 130000, currency: 'USD', period: 'yearly' },
                skills: ['Node.js', 'MongoDB', 'Express', 'Docker', 'AWS'],
                benefits: ['Health Insurance', '401k', 'Stock Options'],
                status: 'active',
                isFeatured: true,
                views: 198,
                applicationsCount: 28
            },
            {
                title: 'UI/UX Designer',
                slug: 'ui-ux-designer-' + (Date.now() + 2),
                description: 'Create stunning user interfaces and experiences for our digital products.',
                requirements: ['3+ years UI/UX experience', 'Proficiency in Figma', 'Strong portfolio', 'Understanding of accessibility standards'],
                responsibilities: ['Design user interfaces for web and mobile', 'Conduct user research and usability testing', 'Create wireframes and prototypes', 'Collaborate with dev team on implementation'],
                company: company2._id,
                postedBy: employer2._id,
                category: 'design',
                type: 'full-time',
                level: 'mid',
                location: 'New York, NY',
                isRemote: true,
                salary: { min: 75000, max: 110000, currency: 'USD', period: 'yearly' },
                skills: ['Figma', 'Adobe XD', 'Prototyping', 'User Research', 'CSS'],
                benefits: ['Health Insurance', 'Remote Work', 'Creative Budget', 'Flexible Hours'],
                status: 'active',
                isFeatured: true,
                views: 256,
                applicationsCount: 38
            },
            {
                title: 'DevOps Engineer',
                slug: 'devops-engineer-' + (Date.now() + 3),
                description: 'Help us build and maintain our cloud infrastructure and CI/CD pipelines.',
                requirements: ['4+ years DevOps experience', 'AWS/GCP/Azure expertise', 'Kubernetes experience', 'Strong scripting skills'],
                responsibilities: ['Manage cloud infrastructure', 'Build and maintain CI/CD pipelines', 'Monitor system performance', 'Automate deployment processes'],
                company: company1._id,
                postedBy: employer1._id,
                category: 'technology',
                type: 'full-time',
                level: 'senior',
                location: 'Remote',
                isRemote: true,
                salary: { min: 110000, max: 150000, currency: 'USD', period: 'yearly' },
                skills: ['AWS', 'Kubernetes', 'Docker', 'Terraform', 'CI/CD'],
                benefits: ['Health Insurance', 'Remote Work', '401k', 'Home Office Stipend'],
                status: 'active',
                isFeatured: false,
                views: 145,
                applicationsCount: 20
            },
            {
                title: 'Junior Frontend Developer',
                slug: 'junior-frontend-developer-' + (Date.now() + 4),
                description: 'Great opportunity for a fresh grad or junior developer to jump-start their career in a supportive environment.',
                requirements: ['1+ year experience or strong portfolio', 'HTML/CSS/JavaScript proficiency', 'React basics', 'Eager to learn'],
                responsibilities: ['Build UI components', 'Fix bugs and improve performance', 'Learn from senior developers', 'Participate in code reviews'],
                company: company1._id,
                postedBy: employer1._id,
                category: 'technology',
                type: 'full-time',
                level: 'entry',
                location: 'San Francisco, CA',
                isRemote: false,
                salary: { min: 60000, max: 80000, currency: 'USD', period: 'yearly' },
                skills: ['HTML', 'CSS', 'JavaScript', 'React'],
                benefits: ['Health Insurance', '401k', 'Training Budget'],
                status: 'active',
                isFeatured: false,
                views: 421,
                applicationsCount: 89
            },
            {
                title: 'Marketing Manager',
                slug: 'marketing-manager-' + (Date.now() + 5),
                description: 'Drive our marketing strategy and brand growth across digital channels.',
                requirements: ['5+ years marketing experience', 'Digital marketing expertise', 'Data-driven mindset', 'Team leadership experience'],
                responsibilities: ['Develop and execute marketing campaigns', 'Manage social media presence', 'Analyze campaign performance', 'Lead a team of 3 marketers'],
                company: company2._id,
                postedBy: employer2._id,
                category: 'marketing',
                type: 'full-time',
                level: 'senior',
                location: 'New York, NY',
                isRemote: false,
                salary: { min: 85000, max: 115000, currency: 'USD', period: 'yearly' },
                skills: ['Digital Marketing', 'SEO', 'Content Strategy', 'Analytics', 'Social Media'],
                benefits: ['Health Insurance', 'Performance Bonus', 'Flexible Hours'],
                status: 'active',
                isFeatured: false,
                views: 178,
                applicationsCount: 32
            },
            {
                title: 'Data Scientist',
                slug: 'data-scientist-' + (Date.now() + 6),
                description: 'We need a skilled Data Scientist to help us extract insights from large datasets and build predictive models.',
                requirements: ['3+ years experience in data science', 'Python proficiency', 'ML/AI knowledge', 'SQL expertise'],
                responsibilities: ['Analyze large datasets', 'Build and deploy ML models', 'Create dashboards and reports', 'Collaborate with product teams'],
                company: company1._id,
                postedBy: employer1._id,
                category: 'data-science',
                type: 'full-time',
                level: 'mid',
                location: 'San Francisco, CA',
                isRemote: true,
                salary: { min: 100000, max: 140000, currency: 'USD', period: 'yearly' },
                skills: ['Python', 'Machine Learning', 'SQL', 'TensorFlow', 'Tableau'],
                benefits: ['Health Insurance', 'Remote Work', '401k', 'Conference Budget'],
                status: 'active',
                isFeatured: true,
                views: 267,
                applicationsCount: 41
            },
            {
                title: 'Graphic Designer (Contract)',
                slug: 'graphic-designer-contract-' + (Date.now() + 7),
                description: 'Short-term contract opportunity for a talented graphic designer to help with a product launch campaign.',
                requirements: ['2+ years graphic design experience', 'Adobe Creative Suite expertise', 'Portfolio required'],
                responsibilities: ['Design marketing materials', 'Create social media graphics', 'Brand consistency across channels'],
                company: company2._id,
                postedBy: employer2._id,
                category: 'design',
                type: 'contract',
                level: 'mid',
                location: 'Remote',
                isRemote: true,
                salary: { min: 40, max: 65, currency: 'USD', period: 'hourly' },
                skills: ['Photoshop', 'Illustrator', 'InDesign', 'Branding'],
                status: 'active',
                isFeatured: false,
                views: 89,
                applicationsCount: 15
            }
        ]);

        console.log(`💼 ${jobs.length} Jobs created`);

        // Update companies total jobs count
        await Company.findByIdAndUpdate(company1._id, { totalJobs: 6 });
        await Company.findByIdAndUpdate(company2._id, { totalJobs: 3 });

        // Create sample applications
        await Application.insertMany([
            {
                job: jobs[0]._id,
                applicant: jobseeker1._id,
                company: company1._id,
                coverLetter: 'I am very interested in the Senior React Developer position. With 3 years of React experience and strong TypeScript skills, I believe I would be a great fit.',
                status: 'shortlisted',
                aiMatchScore: 88,
                timeline: [
                    { status: 'pending', note: 'Application submitted' },
                    { status: 'reviewing', note: 'Application under review' },
                    { status: 'shortlisted', note: 'Candidate shortlisted for interview' }
                ]
            },
            {
                job: jobs[1]._id,
                applicant: jobseeker1._id,
                company: company1._id,
                coverLetter: 'I have extensive Node.js and MongoDB experience and would love to contribute to your backend team.',
                status: 'pending',
                aiMatchScore: 75,
                timeline: [
                    { status: 'pending', note: 'Application submitted' }
                ]
            },
            {
                job: jobs[2]._id,
                applicant: jobseeker2._id,
                company: company2._id,
                coverLetter: 'As a UI/UX Designer passionate about user-centered design, I am excited about this opportunity at Creative Design Studio.',
                status: 'interview',
                aiMatchScore: 92,
                interviewDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                interviewType: 'video',
                timeline: [
                    { status: 'pending', note: 'Application submitted' },
                    { status: 'reviewing', note: 'Portfolio reviewed' },
                    { status: 'shortlisted', note: 'Strong candidate' },
                    { status: 'interview', note: 'Interview scheduled for next week' }
                ]
            }
        ]);

        console.log('📝 Sample applications created');

        console.log('\n✅ Database seeded successfully!\n');
        console.log('═══════════════════════════════════════');
        console.log('Test Accounts:');
        console.log('─────────────────────────────────────');
        console.log('👑 Admin:     admin@jobportal.com / Admin@123');
        console.log('🏢 Employer 1: hr@techcorp.com / Employer@123');
        console.log('🏢 Employer 2: hr@designstudio.com / Employer@123');
        console.log('👤 Jobseeker 1: john@example.com / User@123');
        console.log('👤 Jobseeker 2: jane@example.com / User@123');
        console.log('═══════════════════════════════════════\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding error:', error.message);
        process.exit(1);
    }
};

const destroyData = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        await Promise.all([
            User.deleteMany(),
            Job.deleteMany(),
            Company.deleteMany(),
            Application.deleteMany()
        ]);
        console.log('🗑️  All data destroyed!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Destroy error:', error.message);
        process.exit(1);
    }
};

if (process.argv[2] === '-d') {
    destroyData();
} else {
    seedData();
}
