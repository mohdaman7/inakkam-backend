const User = require('../../models/User');

// @desc    Get user list with full profile info
// @route   GET /api/admin/users
const getUsers = async (req, res, next) => {
    try {
        const users = await User.find({ isEliteAgent: { $ne: true } })
            .select('name email phone gender age bio work education photos interests membership verified verificationStatus isOnline isDeleted createdAt')
            .sort({ createdAt: -1 })
            .lean();

        const formatted = users.map(u => ({
            _id: u._id,
            name: u.name,
            email: u.email || 'N/A',
            phone: u.phone || 'N/A',
            gender: u.gender || 'N/A',
            age: u.age || 'N/A',
            bio: u.bio || '',
            work: u.work || '',
            education: u.education || '',
            photos: u.photos || [],
            interests: u.interests || [],
            membership: u.membership?.plan || 'free',
            verified: !!u.verified,
            verificationStatus: u.verificationStatus || 'NOT_VERIFIED',
            isOnline: !!u.isOnline,
            isDeleted: !!u.isDeleted,
            isSuspended: !!u.isDeleted,
            createdAt: new Date(u.createdAt).toLocaleDateString(),
        }));

        return res.json({ success: true, users: formatted });
    } catch (err) {
        next(err);
    }
};

// @desc    Block / Suspend / Unsuspend user
// @route   PATCH /api/admin/users/:id/block
const toggleBlockUser = async (req, res, next) => {
    try {
        const { blocked } = req.body; // boolean
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        user.isDeleted = typeof blocked === 'boolean' ? blocked : !user.isDeleted;
        await user.save();

        const actionText = user.isDeleted ? 'suspended' : 'activated';
        return res.json({ success: true, isDeleted: user.isDeleted, message: `User ${user.name} has been ${actionText}` });
    } catch (err) {
        next(err);
    }
};

// @desc    Get all elite agents
// @route   GET /api/admin/elite-agents
const getEliteAgents = async (req, res, next) => {
    try {
        const agents = await User.find({ isEliteAgent: true })
            .select('name email phone gender dob state city religion languages photos interests membership verified verificationStatus isOnline isDeleted createdAt wallet occupation payoutDetails')
            .sort({ createdAt: -1 })
            .lean();

        const formatted = agents.map(u => ({
            _id: u._id,
            name: u.name,
            email: u.email || 'N/A',
            phone: u.phone || 'N/A',
            gender: u.gender || 'N/A',
            dob: u.dob || '',
            state: u.state || '',
            city: u.city || '',
            religion: u.religion || '',
            language: u.languages ? u.languages.join(', ') : '',
            photos: u.photos ? u.photos.map(p => p.url) : [],
            interests: u.interests ? u.interests.join(', ') : '',
            membership: u.membership?.plan || 'free',
            verified: !!u.verified,
            verificationStatus: u.verificationStatus || 'NOT_VERIFIED',
            isOnline: !!u.isOnline,
            isDeleted: !!u.isDeleted,
            status: u.isDeleted ? 'Suspended' : 'Active',
            createdAt: new Date(u.createdAt).toLocaleDateString(),
            occupation: u.occupation || '',
            wallet: u.wallet || {
                balance: 0,
                totalCoins: 0,
                todayCoins: 0,
                weeklyCoins: 0,
                monthlyCoins: 0,
                lifetimeEarnings: 0,
                pendingPayout: 0,
                paidAmount: 0
            },
            payoutDetails: u.payoutDetails || {
                bankName: '',
                accountNumber: '',
                ifsc: '',
                upiId: ''
            }
        }));

        return res.json({ success: true, agents: formatted });
    } catch (err) {
        next(err);
    }
};

// @desc    Create an elite agent
// @route   POST /api/admin/elite-agents
const createEliteAgent = async (req, res, next) => {
    try {
        const {
            name, email, password, phone, gender, dob, country, state, city,
            religion, language, interests, aboutMe, height, weight, occupation
        } = req.body;

        // Check if user already exists
        const existingEmail = await User.findOne({ email });
        if (existingEmail) {
            return res.status(400).json({ success: false, message: 'Email already registered' });
        }

        if (phone) {
            const existingPhone = await User.findOne({ phone });
            if (existingPhone) {
                return res.status(400).json({ success: false, message: 'Phone number already registered' });
            }
        }

        // Parse language and interests
        const languagesArray = language ? language.split(',').map(s => s.trim()).filter(Boolean) : [];
        const interestsArray = interests ? interests.split(',').map(s => s.trim()).filter(Boolean) : [];

        // Build User
        const agent = new User({
            name,
            email,
            passwordHash: password, // Will be hashed in pre-save hook
            phone,
            gender: gender || 'Woman',
            dob,
            age: dob ? Math.max(18, new Date().getFullYear() - new Date(dob).getFullYear()) : 25,
            location: {
                type: 'Point',
                coordinates: [0, 0],
                city,
                country: country || 'India'
            },
            state,
            city,
            religion,
            languages: languagesArray,
            interests: interestsArray,
            bio: aboutMe || '',
            height: height || '',
            weight: weight || '',
            occupation: occupation || '',
            isEliteAgent: true,
            verified: true,
            verificationStatus: 'VERIFIED',
            membership: {
                plan: 'premium',
                startDate: new Date(),
                endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 10)) // 10 years membership
            },
            isOnboarded: true,
            wallet: {
                balance: 0,
                totalCoins: 0,
                todayCoins: 0,
                weeklyCoins: 0,
                monthlyCoins: 0,
                lifetimeEarnings: 0,
                pendingPayout: 0,
                paidAmount: 0
            },
            payoutDetails: {
                bankName: 'State Bank of India',
                accountNumber: '•••• •••• ' + Math.floor(1000 + Math.random() * 9000),
                ifsc: 'SBIN0004562',
                upiId: `${name.toLowerCase().replace(/\s+/g, '')}@okaxis`
            }
        });

        await agent.save();

        return res.status(201).json({
            success: true,
            message: 'Elite Agent created successfully',
            agent: {
                _id: agent._id,
                name: agent.name,
                email: agent.email,
                phone: agent.phone
            }
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Get elite agent by ID
// @route   GET /api/admin/elite-agents/:id
const getEliteAgentById = async (req, res, next) => {
    try {
        const agent = await User.findById(req.params.id);
        if (!agent || !agent.isEliteAgent) {
            return res.status(404).json({ success: false, message: 'Elite Agent not found' });
        }

        const formatted = {
            _id: agent._id,
            name: agent.name,
            email: agent.email || 'N/A',
            phone: agent.phone || 'N/A',
            gender: agent.gender || 'N/A',
            dob: agent.dob || '',
            state: agent.state || '',
            city: agent.city || '',
            religion: agent.religion || '',
            language: agent.languages ? agent.languages.join(', ') : '',
            photos: agent.photos ? agent.photos.map(p => p.url) : [],
            interests: agent.interests ? agent.interests.join(', ') : '',
            membership: agent.membership?.plan || 'free',
            verified: !!agent.verified,
            verificationStatus: agent.verificationStatus || 'NOT_VERIFIED',
            isOnline: !!agent.isOnline,
            isDeleted: !!agent.isDeleted,
            status: agent.isDeleted ? 'Suspended' : 'Active',
            createdAt: new Date(agent.createdAt).toLocaleDateString(),
            occupation: agent.occupation || '',
            aboutMe: agent.bio || '',
            height: agent.height || '',
            weight: agent.weight || '',
            wallet: agent.wallet || {
                balance: 0,
                totalCoins: 0,
                todayCoins: 0,
                weeklyCoins: 0,
                monthlyCoins: 0,
                lifetimeEarnings: 0,
                pendingPayout: 0,
                paidAmount: 0
            },
            payoutDetails: agent.payoutDetails || {
                bankName: '',
                accountNumber: '',
                ifsc: '',
                upiId: ''
            }
        };

        return res.json({ success: true, agent: formatted });
    } catch (err) {
        next(err);
    }
};

// @desc    Update elite agent profile
// @route   PUT /api/admin/elite-agents/:id
const updateEliteAgent = async (req, res, next) => {
    try {
        const {
            name, email, phone, gender, dob, country, state, city,
            religion, language, interests, aboutMe, height, weight, occupation
        } = req.body;

        const agent = await User.findById(req.params.id);
        if (!agent || !agent.isEliteAgent) {
            return res.status(404).json({ success: false, message: 'Elite Agent not found' });
        }

        // Parse arrays
        const languagesArray = language ? language.split(',').map(s => s.trim()).filter(Boolean) : [];
        const interestsArray = interests ? interests.split(',').map(s => s.trim()).filter(Boolean) : [];

        agent.name = name || agent.name;
        agent.email = email || agent.email;
        agent.phone = phone || agent.phone;
        agent.gender = gender || agent.gender;
        agent.dob = dob || agent.dob;
        if (dob) {
            agent.age = Math.max(18, new Date().getFullYear() - new Date(dob).getFullYear());
        }
        agent.location = {
            ...agent.location,
            city: city || agent.location?.city,
            country: country || agent.location?.country
        };
        agent.state = state || agent.state;
        agent.city = city || agent.city;
        agent.religion = religion || agent.religion;
        agent.languages = languagesArray;
        agent.interests = interestsArray;
        agent.bio = aboutMe || agent.bio;
        agent.height = height || agent.height;
        agent.weight = weight || agent.weight;
        agent.occupation = occupation || agent.occupation;

        await agent.save();

        return res.json({ success: true, message: 'Elite Agent updated successfully', agent });
    } catch (err) {
        next(err);
    }
};

// @desc    Suspend / Activate Elite Agent
// @route   PATCH /api/admin/elite-agents/:id/status
const toggleEliteAgentStatus = async (req, res, next) => {
    try {
        const agent = await User.findById(req.params.id);
        if (!agent || !agent.isEliteAgent) {
            return res.status(404).json({ success: false, message: 'Elite Agent not found' });
        }

        agent.isDeleted = !agent.isDeleted;
        await agent.save();

        const actionText = agent.isDeleted ? 'suspended' : 'activated';
        return res.json({ success: true, isDeleted: agent.isDeleted, message: `Elite Agent ${agent.name} has been ${actionText}` });
    } catch (err) {
        next(err);
    }
};

// @desc    Reset Elite Agent Password
// @route   POST /api/admin/elite-agents/:id/reset-password
const resetEliteAgentPassword = async (req, res, next) => {
    try {
        const { password } = req.body;
        const agent = await User.findById(req.params.id);
        if (!agent || !agent.isEliteAgent) {
            return res.status(404).json({ success: false, message: 'Elite Agent not found' });
        }

        agent.passwordHash = password; // Will be hashed in pre-save
        await agent.save();

        return res.json({ success: true, message: 'Password reset successfully' });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getUsers,
    toggleBlockUser,
    getEliteAgents,
    createEliteAgent,
    getEliteAgentById,
    updateEliteAgent,
    toggleEliteAgentStatus,
    resetEliteAgentPassword
};
