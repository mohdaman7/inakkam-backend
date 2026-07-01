const User = require('../../models/User');
const Interest = require('../../models/Interest');
const Language = require('../../models/Language');
const bcrypt = require('bcryptjs');

const firstNames = ['Amit', 'Pooja', 'Rahul', 'Neha', 'Sanjay', 'Aarti', 'Vikram', 'Divya', 'Deepak', 'Sneha', 'Rajesh', 'Priya', 'Anil', 'Sunita', 'Vijay', 'Kiran', 'Arjun', 'Meera', 'Rohan', 'Aditi'];
const lastNames = ['Sharma', 'Verma', 'Gupta', 'Patel', 'Singh', 'Kumar', 'Joshi', 'Mehta', 'Reddy', 'Iyer', 'Nair', 'Shah', 'Rao', 'Choudhary', 'Das', 'Sen', 'Pillai', 'Sinha', 'Bajaj', 'Kapoor'];
const bios = [
    'Coffee enthusiast, traveler, and book lover.',
    'Looking for someone to share good food and deep conversations.',
    'Fitness junkie, outdoor explorer, and weekend baker.',
    'Always up for a live concert or a new art exhibit.',
    'Life is short, make every sandwich count.',
    'Tech geek by day, movie critic by night.',
    'Passionate about photography, hiking, and road trips.',
    'Music is my escape. Tell me your favorite band!',
];

// @desc    Generate fake users
// @route   POST /api/admin/fake-users
const generateFakeUsers = async (req, res, next) => {
    try {
        const {
            count = 5,
            password = 'password123',
            gender = 'Random',
            preference = 'Opposite',
            interests: interestCount = 3,
            languages: languageCount = 2,
            latitude,
            longitude,
            radius = 50,
            countryCode = '+91',
        } = req.body;

        const numCount = Number(count);
        const passHash = await bcrypt.hash(password, 12);

        // Fetch interests and languages to randomly assign
        const [dbInterests, dbLanguages] = await Promise.all([
            Interest.find({ status: 1 }).select('title'),
            Language.find({ status: 1 }).select('title'),
        ]);

        const interestPool = dbInterests.map(i => i.title);
        const languagePool = dbLanguages.map(l => l.title);

        const newUsers = [];

        for (let i = 0; i < numCount; i++) {
            const fName = firstNames[Math.floor(Math.random() * firstNames.length)];
            const lName = lastNames[Math.floor(Math.random() * lastNames.length)];
            const name = `${fName} ${lName}`;
            const email = `fake_${Date.now()}_${i}@inakkam.com`;
            const phone = `${countryCode}${Math.floor(1000000000 + Math.random() * 9000000000)}`;

            const age = Math.floor(18 + Math.random() * 25); // 18 to 43
            const bio = bios[Math.floor(Math.random() * bios.length)];

            // Determine gender
            let userGender = 'Man';
            if (gender === 'Female') userGender = 'Woman';
            else if (gender === 'Random') userGender = Math.random() > 0.5 ? 'Man' : 'Woman';

            // Determine preference
            let interestedIn = [];
            if (preference === 'Same As Gender') interestedIn = [userGender];
            else if (preference === 'Opposite') interestedIn = [userGender === 'Man' ? 'Woman' : 'Man'];
            else interestedIn = ['Man', 'Woman'];

            // Random interests & languages
            const userInterests = [];
            const userLanguages = [];

            if (interestPool.length > 0) {
                const shuffled = [...interestPool].sort(() => 0.5 - Math.random());
                userInterests.push(...shuffled.slice(0, Math.min(Number(interestCount), interestPool.length)));
            } else {
                userInterests.push('Music', 'Travel', 'Movies');
            }

            if (languagePool.length > 0) {
                const shuffled = [...languagePool].sort(() => 0.5 - Math.random());
                userLanguages.push(...shuffled.slice(0, Math.min(Number(languageCount), languagePool.length)));
            } else {
                userLanguages.push('English', 'Hindi');
            }

            // Determine mock coordinates
            let lat = latitude ? Number(latitude) : 13.0827; // Default Chennai
            let lng = longitude ? Number(longitude) : 80.2707;

            if (latitude || longitude) {
                // Add random offset within radius (approx offset: 1km is ~0.009 deg)
                const offsetRadius = (radius * Math.random()) / 111; // max offset in degrees
                const angle = Math.random() * Math.PI * 2;
                lat += Math.cos(angle) * offsetRadius;
                lng += Math.sin(angle) * offsetRadius;
            }

            newUsers.push({
                name,
                email,
                phone,
                passwordHash: passHash,
                age,
                bio,
                gender: userGender,
                interestedIn,
                interests: userInterests,
                languages: userLanguages,
                location: {
                    type: 'Point',
                    coordinates: [lng, lat],
                    city: 'Mock City',
                    country: 'Mock Country',
                },
                photos: [
                    {
                        url: `https://images.unsplash.com/photo-${userGender === 'Man' ? '1500648767791-00dcc994a43e' : '1494790108377-be9c29b29330'}?auto=format&fit=crop&w=500&q=80`,
                        publicId: 'mock-fake-profile',
                    }
                ],
                isOnboarded: true,
                verified: true,
                isFake: true,
            });
        }

        await User.insertMany(newUsers);

        return res.json({ success: true, message: `${numCount} fake users generated successfully.` });
    } catch (err) {
        next(err);
    }
};

module.exports = { generateFakeUsers };
