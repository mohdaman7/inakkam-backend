require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');
const Admin = require('../models/Admin');
const Interest = require('../models/Interest');
const Language = require('../models/Language');
const Religion = require('../models/Religion');
const RelationGoal = require('../models/RelationGoal');
const FAQ = require('../models/FAQ');
const Plan = require('../models/Plan');
const Package = require('../models/Package');
const PaymentGateway = require('../models/PaymentGateway');
const Payout = require('../models/Payout');
const Report = require('../models/Report');
const User = require('../models/User');

const interests = [
    { title: 'Music', image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=150&q=80', status: 1 },
    { title: 'Travel', image: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=150&q=80', status: 1 },
    { title: 'Cooking', image: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=150&q=80', status: 1 },
    { title: 'Fitness', image: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=150&q=80', status: 1 },
    { title: 'Gaming', image: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&w=150&q=80', status: 1 },
    { title: 'Reading', image: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=150&q=80', status: 1 },
    { title: 'Movies', image: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=150&q=80', status: 1 },
    { title: 'Art', image: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=150&q=80', status: 1 },
    { title: 'Sports', image: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=150&q=80', status: 1 },
];

const languages = [
    { title: 'Tamil', status: 1 },
    { title: 'English', status: 1 },
    { title: 'Hindi', status: 1 },
    { title: 'Spanish', status: 1 },
    { title: 'French', status: 1 },
    { title: 'German', status: 1 },
    { title: 'Malayalam', status: 1 },
    { title: 'Telugu', status: 1 },
    { title: 'Kannada', status: 1 },
];

const religions = [
    { title: 'Hinduism', status: 1 },
    { title: 'Christianity', status: 1 },
    { title: 'Islam', status: 1 },
    { title: 'Buddhism', status: 1 },
    { title: 'Sikhism', status: 1 },
    { title: 'Jainism', status: 1 },
    { title: 'Spiritual', status: 1 },
    { title: 'Atheist', status: 1 },
];

const relationGoals = [
    { title: 'Long-term partner', subtitle: 'Looking for a lifetime commitment', status: 1 },
    { title: 'Short-term fun', subtitle: 'Casual dating and fun moments', status: 1 },
    { title: 'New friends', subtitle: 'Socializing and expand network', status: 1 },
    { title: 'Dating but open', subtitle: 'Starting casual, open to more', status: 1 },
    { title: 'Still figuring it out', subtitle: 'Going with the flow', status: 1 },
];

const faqs = [
    { question: 'What is Inakkam?', answer: 'Inakkam is a premium dating and matchmaking platform designed to help you find meaningful relationships and deep connections.', status: 1 },
    { question: 'How do matches work?', answer: 'Matches occur when two users swipe right (like) on each other. Once a match is made, you can start messaging immediately.', status: 1 },
    { question: 'What is Inakkam Boost?', answer: 'Inakkam Boost is a premium upgrade that highlights your profile to potential matches in your area for faster results.', status: 1 },
    { question: 'How do I complete KYC?', answer: 'Go to Verification in your profile page and upload your ID details (Aadhaar or PAN) along with a live selfie.', status: 1 },
    { question: 'Is my data secure?', answer: 'Absolutely. We use industry-standard encryption and strict privacy protocols to protect your personal information and documents.', status: 1 },
];

const plans = [
    { title: 'Inakkam Boost', amount: 14.99, dayLimit: 30, description: 'Priority likes & profile spotlight.', filterInclude: true, audioVideo: false, directChat: false, chat: true, likeMenu: true, status: 1 },
    { title: 'Inakkam Premium', amount: 29.99, dayLimit: 30, description: 'Unlimited swiping, advanced filters, see who likes you.', filterInclude: true, audioVideo: true, directChat: true, chat: true, likeMenu: true, status: 1 },
    { title: 'Inakkam Lifetime', amount: 119.99, dayLimit: 9999, description: 'All premium features unlocked forever.', filterInclude: true, audioVideo: true, directChat: true, chat: true, likeMenu: true, status: 1 },
];

const packages = [
    { totalCoin: 100, amount: 4.99, status: 1 },
    { totalCoin: 250, amount: 9.99, status: 1 },
    { totalCoin: 600, amount: 19.99, status: 1 },
];

const gateways = [
    { name: 'Razorpay', subtitle: 'Cards, Netbanking & UPI', image: '', status: 1, showOnWallet: 1 },
    { name: 'Stripe', subtitle: 'Global Cards & Wallets', image: '', status: 1, showOnWallet: 1 },
    { name: 'PayPal', subtitle: 'International Payments', image: '', status: 1, showOnWallet: 1 },
    { name: 'Paytm', subtitle: 'Indian wallets & UPI', image: '', status: 1, showOnWallet: 1 },
];

const seed = async () => {
    try {
        console.log('Connecting to database...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Database connected successfully! Seeding collections...');

        // 1. Seed Admin
        await Admin.deleteMany({});
        const adminUser = await Admin.create({
            name: 'Administrator',
            email: 'admin@inakkam.com',
            passwordHash: 'admin@123',
            role: 'superadmin',
            permissions: { all: true },
        });
        console.log('✅ Admin seeded successfully: admin@inakkam.com / admin@123');

        // 2. Seed Interests
        await Interest.deleteMany({});
        await Interest.insertMany(interests);
        console.log('✅ Interests seeded');

        // 3. Seed Languages
        await Language.deleteMany({});
        await Language.insertMany(languages);
        console.log('✅ Languages seeded');

        // 4. Seed Religions
        await Religion.deleteMany({});
        await Religion.insertMany(religions);
        console.log('✅ Religions seeded');

        // 5. Seed Relation Goals
        await RelationGoal.deleteMany({});
        await RelationGoal.insertMany(relationGoals);
        console.log('✅ Relation Goals seeded');

        // 6. Seed FAQs
        await FAQ.deleteMany({});
        await FAQ.insertMany(faqs);
        console.log('✅ FAQs seeded');

        // 7. Seed Plans
        await Plan.deleteMany({});
        await Plan.insertMany(plans);
        console.log('✅ Plans seeded');

        // 8. Seed Packages
        await Package.deleteMany({});
        await Package.insertMany(packages);
        console.log('✅ Packages seeded');

        // 9. Seed Gateways
        await PaymentGateway.deleteMany({});
        await PaymentGateway.insertMany(gateways);
        console.log('✅ Gateways seeded');

        // 10. Seed some fake users for Discover page functionality
        const existingFakeUsers = await User.countDocuments({ isFake: true });
        if (existingFakeUsers === 0) {
            const sampleUsers = [
                {
                    name: 'Aarav Shah',
                    email: 'aarav@example.com',
                    phone: '+919999999991',
                    passwordHash: '$2a$12$6K6W.H3cZ/Bq9p6csw1B2u3B6uW/6p4E7n4Z0tK.eMvJ6kC1f3D9O', // 'password123'
                    age: 26,
                    bio: 'Tech enthusiast, love trekking and indie music.',
                    gender: 'Man',
                    interestedIn: ['Woman'],
                    interests: ['Music', 'Travel', 'Sports'],
                    languages: ['English', 'Hindi'],
                    location: { type: 'Point', coordinates: [80.2707, 13.0827], city: 'Chennai', country: 'India' },
                    photos: [{ url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80', publicId: 'mock-1' }],
                    isOnboarded: true,
                    verified: true,
                    isFake: true,
                },
                {
                    name: 'Priya Nair',
                    email: 'priya@example.com',
                    phone: '+919999999992',
                    passwordHash: '$2a$12$6K6W.H3cZ/Bq9p6csw1B2u3B6uW/6p4E7n4Z0tK.eMvJ6kC1f3D9O',
                    age: 24,
                    bio: 'Food blogger and avid reader. Let’s grab a cup of coffee!',
                    gender: 'Woman',
                    interestedIn: ['Man'],
                    interests: ['Cooking', 'Reading', 'Art'],
                    languages: ['English', 'Tamil'],
                    location: { type: 'Point', coordinates: [80.2507, 13.0627], city: 'Chennai', country: 'India' },
                    photos: [{ url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80', publicId: 'mock-2' }],
                    isOnboarded: true,
                    verified: true,
                    isFake: true,
                },
                {
                    name: 'Rohit Verma',
                    email: 'rohit@example.com',
                    phone: '+919999999993',
                    passwordHash: '$2a$12$6K6W.H3cZ/Bq9p6csw1B2u3B6uW/6p4E7n4Z0tK.eMvJ6kC1f3D9O',
                    age: 28,
                    bio: 'Fitness trainer, movie buff, outdoor explorer.',
                    gender: 'Man',
                    interestedIn: ['Woman'],
                    interests: ['Fitness', 'Movies', 'Travel'],
                    languages: ['English', 'Hindi'],
                    location: { type: 'Point', coordinates: [80.2907, 13.1027], city: 'Chennai', country: 'India' },
                    photos: [{ url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80', publicId: 'mock-3' }],
                    isOnboarded: true,
                    verified: true,
                    isFake: true,
                },
                {
                    name: 'Sneha Kapoor',
                    email: 'sneha@example.com',
                    phone: '+919999999994',
                    passwordHash: '$2a$12$6K6W.H3cZ/Bq9p6csw1B2u3B6uW/6p4E7n4Z0tK.eMvJ6kC1f3D9O',
                    age: 23,
                    bio: 'Gamer girl, animal lover, looking for deep conversations.',
                    gender: 'Woman',
                    interestedIn: ['Man'],
                    interests: ['Gaming', 'Music', 'Movies'],
                    languages: ['English', 'Hindi'],
                    location: { type: 'Point', coordinates: [80.2607, 13.0727], city: 'Chennai', country: 'India' },
                    photos: [{ url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80', publicId: 'mock-4' }],
                    isOnboarded: true,
                    verified: true,
                    isFake: true,
                }
            ];

            const created = await User.insertMany(sampleUsers);
            console.log(`✅ Seeding ${created.length} onboarded fake profiles completed.`);
        }

        // 11. Seed some mock payouts
        const users = await User.find({ isFake: true }).limit(2);
        if (users.length >= 2) {
            await Payout.deleteMany({});
            await Payout.create([
                { userId: users[0]._id, userName: users[0].name, amount: 1500, coin: 300, transferType: 'UPI', mobile: users[0].phone, status: 'Pending' },
                { userId: users[1]._id, userName: users[1].name, amount: 2500, coin: 500, transferType: 'Bank', mobile: users[1].phone, status: 'Completed' }
            ]);
            console.log('✅ Mock Payouts seeded');

            // 12. Seed some mock reports
            await Report.deleteMany({});
            await Report.create({
                reporter: users[0]._id,
                reported: users[1]._id,
                reason: 'spam',
                description: 'Sent commercial messages multiple times.',
                status: 'pending'
            });
            console.log('✅ Mock Reports seeded');
        }

        console.log('\n🌟 Master database seeding completed successfully! 🌟');
        process.exit(0);
    } catch (err) {
        console.error('❌ Seeding error:', err);
        process.exit(1);
    }
};

seed();
