const express = require('express');
const router = express.Router();
const {
    getCoinPackages,
    purchaseCoins,
    deductMessageCoin,
    deductCallCoin,
    sendGift
} = require('../controllers/coinController');
const { protect } = require('../middlewares/auth');

router.get('/packages', getCoinPackages);
router.post('/purchase', protect, purchaseCoins);
router.post('/deduct-message', protect, deductMessageCoin);
router.post('/deduct-call', protect, deductCallCoin);
router.post('/send-gift', protect, sendGift);

module.exports = router;
