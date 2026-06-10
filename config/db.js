const crypto = require('crypto');
const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        console.log('Attempting to connect to MongoDB...');
        const conn = await mongoose.connect(process.env.MONGODB_URI);
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    } catch (err) {
        console.error(`❌ MongoDB Error: ${err.message}`);
        console.error(`Stack trace:`, err.stack);
        process.exit(1);
    }
};

module.exports = connectDB;
