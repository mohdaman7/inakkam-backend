const express = require('express');
const router = express.Router();
const { getPlans, subscribe, getMembershipStatus } = require('../controllers/membershipController');
const { protect } = require('../middlewares/auth');

router.get('/plans', getPlans); // public
router.use(protect);
router.get('/status', getMembershipStatus);
router.post('/subscribe', subscribe);

module.exports = router;
