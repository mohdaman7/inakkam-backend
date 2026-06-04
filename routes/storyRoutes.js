const express = require('express');
const router = express.Router();
const { getStories, createStory, viewStory } = require('../controllers/storyController');
const { protect } = require('../middlewares/auth');
const { uploadStory } = require('../config/cloudinary');

router.use(protect);
router.get('/', getStories);
router.post('/', uploadStory.single('media'), createStory);
router.post('/:id/view', viewStory);

module.exports = router;
