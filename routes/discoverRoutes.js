const express = require('express');
const router = express.Router();
const { getDiscover } = require('../controllers/discoverController');
const { protect } = require('../middlewares/auth');

router.use(protect);
router.get('/', getDiscover);

module.exports = router;
