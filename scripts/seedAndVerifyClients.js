const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const Admin = require('../models/Admin');
const User = require('../models/User');

const accounts = {
    admin: [
        {
            name: 'Administrator',
            email: 'admin@gmail.com',
            passwords: ['admin123', 'admin@123'],
            role: 'superadmin',
            permissions: { all: true }
        },
        {
            name: 'Administrator',
            email: 'admin@inakkam.com',
            passwords: ['admin123', 'admin@123'],
            role: 'superadmin',
            permissions: { all: true }
        }
    ],
    customers: [
        {
            name: 'Aarav Shah',
            email: 'aarav.shah@gmail.com',
            phone: '+919876543210',
            password: 'Inakkam@2025',
            age: 26,
            gender: 'Man',
            isOnboarded: true,
            verified: true
        },
        {
            name: 'Priya Das',
            email: 'priya.das@gmail.com',
            phone: '+919876543211',
            password: 'Inakkam@2025',
            age: 24,
            gender: 'Woman',
            isOnboarded: true,
            verified: true
        },
        {
            name: 'Muhammed Aman',
            email: 'muhammedaman2.oaman@gmail.com',
            phone: '+919876543212',
            password: 'mohdaman',
            age: 25,
            gender: 'Man',
            isOnboarded: true,
            verified: true
        }
    ],
    agents: [
        {
            name: 'Anjali',
            email: 'anjali@inakkam.com',
            phone: '+919876543220',
            password: 'Inakkam@2025',
            gender: 'Woman',
            isEliteAgent: true,
            isStaff: true,
            role: 'staff',
            isOnboarded: true,
            verified: true
        },
        {
            name: 'Gauri',
            email: 'gauri@inakkam.com',
            phone: '+919876543221',
            password: 'Inakkam@2025',
            gender: 'Woman',
            isEliteAgent: true,
            isStaff: true,
            role: 'staff',
            isOnboarded: true,
            verified: true
        },
        {
            name: 'Rhea',
            email: 'rhea.agent@inakkam.com',
            phone: '+919876543222',
            password: 'Inakkam@2025',
            gender: 'Woman',
            isEliteAgent: true,
            isStaff: true,
            role: 'staff',
            isOnboarded: true,
            verified: true
        }
    ]
};

async function run() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB successfully!\n');

        // 1. Seed / Update Admin accounts
        console.log('--- ADMIN ACCOUNTS SETUP & VERIFICATION ---');
        for (const adm of accounts.admin) {
            let existing = await Admin.findOne({ email: adm.email.toLowerCase() });
            if (!existing) {
                existing = new Admin({
                    name: adm.name,
                    email: adm.email.toLowerCase(),
                    passwordHash: adm.passwords[0],
                    role: adm.role,
                    permissions: adm.permissions,
                    isActive: true
                });
                await existing.save();
                console.log(`[CREATED] Admin: ${adm.email}`);
            } else {
                existing.passwordHash = adm.passwords[0];
                existing.isActive = true;
                existing.permissions = { all: true };
                await existing.save();
                console.log(`[UPDATED] Admin: ${adm.email}`);
            }

            // Test password match
            const loaded = await Admin.findOne({ email: adm.email.toLowerCase() }).select('+passwordHash');
            const matches = await loaded.matchPassword(adm.passwords[0]);
            console.log(`   Verification (${adm.passwords[0]}): ${matches ? '✅ SUCCESS' : '❌ FAILED'}`);
        }

        // 2. Seed / Update Customer accounts
        console.log('\n--- CUSTOMER ACCOUNTS SETUP & VERIFICATION ---');
        for (const cust of accounts.customers) {
            let existing = await User.findOne({ email: cust.email.toLowerCase() });
            if (!existing) {
                existing = new User({
                    name: cust.name,
                    email: cust.email.toLowerCase(),
                    phone: cust.phone,
                    passwordHash: cust.password,
                    age: cust.age,
                    gender: cust.gender,
                    isOnboarded: true,
                    verified: true
                });
                await existing.save();
                console.log(`[CREATED] Customer: ${cust.email}`);
            } else {
                existing.passwordHash = cust.password;
                existing.isOnboarded = true;
                existing.verified = true;
                existing.isDeleted = false;
                await existing.save();
                console.log(`[UPDATED] Customer: ${cust.email}`);
            }

            // Test password match
            const loaded = await User.findOne({ email: cust.email.toLowerCase() }).select('+passwordHash');
            const matches = await loaded.matchPassword(cust.password);
            console.log(`   Verification (${cust.password}): ${matches ? '✅ SUCCESS' : '❌ FAILED'}`);
        }

        // 3. Seed / Update Agent accounts
        console.log('\n--- AGENT ACCOUNTS SETUP & VERIFICATION ---');
        for (const ag of accounts.agents) {
            let existing = await User.findOne({ email: ag.email.toLowerCase() });
            if (!existing) {
                existing = new User({
                    name: ag.name,
                    email: ag.email.toLowerCase(),
                    phone: ag.phone,
                    passwordHash: ag.password,
                    gender: ag.gender,
                    isEliteAgent: true,
                    isStaff: true,
                    role: 'staff',
                    isOnboarded: true,
                    verified: true
                });
                await existing.save();
                console.log(`[CREATED] Agent: ${ag.email}`);
            } else {
                existing.passwordHash = ag.password;
                existing.isEliteAgent = true;
                existing.isStaff = true;
                existing.role = 'staff';
                existing.isOnboarded = true;
                existing.verified = true;
                existing.isDeleted = false;
                await existing.save();
                console.log(`[UPDATED] Agent: ${ag.email}`);
            }

            // Test password match
            const loaded = await User.findOne({ email: ag.email.toLowerCase() }).select('+passwordHash');
            const matches = await loaded.matchPassword(ag.password);
            console.log(`   Verification (${ag.password}): ${matches ? '✅ SUCCESS' : '❌ FAILED'}`);
        }

        console.log('\n🎉 ALL CLIENT CREDENTIALS HAVE BEEN SEEDED AND VERIFIED DIRECTLY IN THE DATABASE!');
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

run();
