const express = require('express');
const router = express.Router();
const {
    getCoinPackages,
    purchaseCoins,
    submitCoinRequest,
    getMyCoinRequests,
    deductMessageCoin,
    deductCallCoin,
    sendGift,
    getActiveGifts,
    claimGift
} = require('../controllers/coinController');
const { protect, optionalAuth } = require('../middlewares/auth');

router.get('/packages', getCoinPackages);
router.post('/purchase', protect, purchaseCoins);
router.post('/request', protect, submitCoinRequest);
router.get('/my-requests', protect, getMyCoinRequests);
router.post('/deduct-message', protect, deductMessageCoin);
router.post('/deduct-call', protect, deductCallCoin);
router.post('/send-gift', protect, sendGift);
router.get('/active-gifts', optionalAuth, getActiveGifts);
router.post('/claim-gift/:id', protect, claimGift);

module.exports = router;
