const express = require('express');
const router = express.Router();
const { recordSwipe, undoSwipe, getReceivedLikes } = require('../controllers/swipeController');
const { protect, requirePremium } = require('../middlewares/auth');
const { swipeLimiter } = require('../middlewares/rateLimiter');

router.use(protect);
router.post('/', swipeLimiter, recordSwipe);
router.delete('/undo', requirePremium, undoSwipe);
router.get('/received-likes', getReceivedLikes);
router.get('/likes', getReceivedLikes);

module.exports = router;

