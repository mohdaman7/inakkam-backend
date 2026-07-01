const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const { createReport } = require('../controllers/reportController');

router.post('/', protect, createReport);

module.exports = router;
