const express = require('express');
const router = express.Router();
const { getMatches, unmatch } = require('../controllers/matchController');
const { protect } = require('../middlewares/auth');

router.use(protect);
router.get('/', getMatches);
router.delete('/:matchId', unmatch);

module.exports = router;
