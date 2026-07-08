const User = require('../models/User');
const Swipe = require('../models/Swipe');

// Compute distance between two coordinates in km using Haversine formula
const getDistance = (coords1, coords2) => {
    if (!coords1 || !coords2 || coords1.length < 2 || coords2.length < 2) return null;
    const [lon1, lat1] = coords1;
    const [lon2, lat2] = coords2;
    if ((lon1 === 0 && lat1 === 0) || (lon2 === 0 && lat2 === 0)) return null;

    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

// Compute a match score based on shared interests and proximity
const computeMatchScore = (userA, userB, distanceKm) => {
    const setA = new Set((userA.interests || []).map(i => i.toLowerCase()));
    const setB = new Set((userB.interests || []).map(i => i.toLowerCase()));
    const shared = [...setA].filter(i => setB.has(i)).length;
    const total = new Set([...setA, ...setB]).size;
    
    let interestScore = total === 0 ? 50 : Math.round(50 + (shared / total) * 50);

    // Factor in distance proximity (up to 10 points bonus if very close)
    let proximityBonus = 0;
    if (distanceKm !== null && distanceKm !== undefined) {
        const maxD = userA.maxDistance || 50;
        proximityBonus = Math.max(0, 1 - (distanceKm / maxD)) * 10;
    }

    return Math.min(99, Math.round(interestScore + proximityBonus));
};

// @desc    Get potential matches (paginated, already-swiped excluded)
// @route   GET /api/discover?page=1&limit=20
// @access  Private
const getDiscover = async (req, res, next) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const me = req.user;

        // Get IDs the current user has already swiped
        const swiped = await Swipe.find({ swiper: me._id }).select('swiped').lean();
        const swipedIds = swiped.map(s => s.swiped);

        // Exclude: self, already-swiped, blocked
        const excludedIds = [me._id, ...swipedIds, ...(me.blockedUsers || [])];

        const filter = {
            _id: { $nin: excludedIds },
            isDeleted: false,
            isOnboarded: true,
        };

        // Filter by gender preference
        if (me.interestedIn && me.interestedIn.length > 0) {
            filter.gender = { $in: me.interestedIn };
        }

        // Filter by age range preference
        if (me.ageRange) {
            filter.age = { $gte: me.ageRange.min || 18, $lte: me.ageRange.max || 99 };
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const users = await User.find(filter)
            .select('name age bio work education photos interests prompts zodiac height exercise relationship religion languages verified badges location lastActive isOnline')
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        // Map users and calculate real distance and matching percentage
        const enriched = users.map(u => {
            let distanceVal = null;
            let distanceStr = 'Unknown distance';

            if (me.location?.coordinates && u.location?.coordinates) {
                const dist = getDistance(me.location.coordinates, u.location.coordinates);
                if (dist !== null) {
                    distanceVal = dist;
                    distanceStr = dist < 1 ? 'Less than a km away' : `${Math.round(dist)} km away`;
                }
            }

            return {
                ...u,
                matchPercentage: computeMatchScore(me, u, distanceVal),
                distance: distanceStr,
                distanceKm: distanceVal
            };
        });

        // Optional: Filter out users beyond maxDistance if user has a location set
        const filtered = enriched.filter(u => {
            if (u.distanceKm !== null && me.maxDistance) {
                return u.distanceKm <= me.maxDistance;
            }
            return true;
        });

        return res.json({ success: true, users: filtered, page: parseInt(page) });
    } catch (err) {
        next(err);
    }
};

module.exports = { getDiscover };
