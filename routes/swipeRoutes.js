const express = require('express');
const router = express.Router();
const { recordSwipe, undoSwipe } = require('../controllers/swipeController');
const { protect, requirePremium } = require('../middlewares/auth');
const { swipeLimiter } = require('../middlewares/rateLimiter');

router.use(protect);
router.post('/', swipeLimiter, recordSwipe);
router.delete('/undo', requirePremium, undoSwipe);

module.exports = router;
