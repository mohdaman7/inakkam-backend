const express = require('express');
const router = express.Router();
const { createRoom, getToken } = require('../controllers/enablexController');
const { protect } = require('../middlewares/auth');

router.use(protect);
router.post('/create-room', createRoom);
router.post('/get-token', getToken);

module.exports = router;
