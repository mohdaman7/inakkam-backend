const express = require('express');
const router = express.Router();
const { requestPayout, getMyPayouts } = require('../controllers/payoutController');
const { protect } = require('../middlewares/auth');

router.use(protect);
router.post('/request', requestPayout);
router.get('/my-payouts', getMyPayouts);

module.exports = router;
