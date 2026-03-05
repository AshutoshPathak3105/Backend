require('dotenv').config();
const mongoose = require('mongoose');
const Company = require('./models/Company');

const resetLogos = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        const result = await Company.updateMany({}, { $set: { logo: '' } });
        console.log(`🗑️  Cleared logos for ${result.modifiedCount} companies`);

        console.log('✅ Logo reset completed!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err);
        process.exit(1);
    }
};

resetLogos();
