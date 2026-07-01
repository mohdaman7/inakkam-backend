const crypto = require('crypto');
const dns = require('dns');
const mongoose = require('mongoose');

dns.setServers(['8.8.8.8', '1.1.1.1']);

const connectDB = async () => {
    try {
        console.log('Attempting to connect to MongoDB...');
        const mongoUri = process.env.MONGODB_URI;

        if (!mongoUri || typeof mongoUri !== 'string' || !mongoUri.trim()) {
            throw new Error('Missing MONGODB_URI environment variable. Ensure .env contains MONGODB_URI and dotenv is loading correctly.');
        }

        const conn = await mongoose.connect(mongoUri);
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    } catch (err) {
        console.error(`❌ MongoDB Error: ${err.message}`);
        console.error(`Stack trace:`, err.stack);
        process.exit(1);
    }
};

module.exports = connectDB;
