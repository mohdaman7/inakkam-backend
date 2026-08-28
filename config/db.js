const path = require('path');
const crypto = require('crypto');
const dns = require('dns');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const dnsServers = (process.env.MONGODB_DNS_SERVERS || '8.8.8.8,1.1.1.1')
    .split(',')
    .map((server) => server.trim())
    .filter(Boolean);

if (dnsServers.length > 0) {
    dns.setServers(dnsServers);
}

const connectDB = async () => {
    try {
        console.log('Attempting to connect to MongoDB...');
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

        if (!mongoUri || typeof mongoUri !== 'string' || !mongoUri.trim()) {
            throw new Error('Missing MongoDB connection string. Ensure .env contains MONGODB_URI or MONGO_URI and dotenv is loading correctly.');
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
