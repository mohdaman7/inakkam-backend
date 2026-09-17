const express = require('express');
const router = express.Router();
const { getPublicPages, getPageBySlug } = require('../controllers/pageController');

router.get('/', getPublicPages);
router.get('/:slug', getPageBySlug);

module.exports = router;
