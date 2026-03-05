require('dotenv').config();
const mongoose = require('mongoose');
const Company = require('./models/Company');

const companyLogos = {
    'TCS': 'tcs.com',
    'Infosys': 'infosys.com',
    'Wipro': 'wipro.com',
    'HCLTech': 'hcltech.com',
    'Tech Mahindra': 'techmahindra.com',
    'HDFC Bank': 'hdfcbank.com',
    'ICICI Bank': 'icicibank.com',
    'SBI': 'sbi.co.in',
    'Apollo Hospitals': 'apollohospitals.com',
    'Sun Pharma': 'sunpharma.com',
    'Apple': 'apple.com',
    'Microsoft': 'microsoft.com',
    'Google': 'google.com',
    'Amazon': 'amazon.com',
    'Meta': 'meta.com',
    'J.P. Morgan': 'jpmorgan.com',
    'Goldman Sachs': 'goldmansachs.com',
    'Morgan Stanley': 'morganstanley.com',
    'Pfizer': 'pfizer.com',
    'Johnson & Johnson': 'jnj.com',
    'Airbnb': 'airbnb.com',
    'Creative Design Studio': 'behance.net',
    'TechCorp Solutions': 'ibm.com',
    'Coursera': 'coursera.org',
    'Salesforce': 'salesforce.com',
    'Netflix': 'netflix.com'
};

const updateLogos = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        const companies = await Company.find({});
        console.log(`🔍 Found ${companies.length} companies`);

        for (const company of companies) {
            const domain = companyLogos[company.name];
            if (domain) {
                const logoUrl = `https://logo.clearbit.com/${domain}`;
                await Company.findByIdAndUpdate(company._id, { logo: logoUrl });
                console.log(`🖼️  Updated logo for ${company.name}`);
            } else if (company.website) {
                try {
                    const url = new URL(company.website);
                    const domainFromUrl = url.hostname.replace('www.', '');
                    const logoUrl = `https://logo.clearbit.com/${domainFromUrl}`;
                    await Company.findByIdAndUpdate(company._id, { logo: logoUrl });
                    console.log(`🖼️  Updated logo for ${company.name} from website URL`);
                } catch (e) {
                    // skip
                }
            }
        }

        console.log('✅ Logo update completed!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err);
        process.exit(1);
    }
};

updateLogos();
