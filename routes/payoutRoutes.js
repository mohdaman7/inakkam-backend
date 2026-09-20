const express = require('express');
const router = express.Router();
const { requestPayout, getMyPayouts, updatePayoutDetails } = require('../controllers/payoutController');
const { protect } = require('../middlewares/auth');

router.use(protect);
router.post('/request', requestPayout);
router.get('/my-payouts', getMyPayouts);
router.put('/details', updatePayoutDetails);
router.post('/details', updatePayoutDetails);

module.exports = router;
