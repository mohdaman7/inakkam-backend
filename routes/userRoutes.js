const express = require('express');
const router = express.Router();
const { getMe, updateMe, completeOnboarding, uploadPhoto, deletePhoto, getUserById, getOnboardingOptions } = require('../controllers/userController');
const { protect } = require('../middlewares/auth');
const { uploadPhoto: multerPhoto } = require('../config/cloudinary');

router.use(protect);

router.get('/me', getMe);
router.get('/onboarding-options', getOnboardingOptions);
router.put('/me', updateMe);
router.put('/me/onboarding', completeOnboarding);
router.post('/me/photos', multerPhoto.single('photo'), uploadPhoto);
router.delete('/me/photos/:photoId', deletePhoto);
router.get('/:id', getUserById);

module.exports = router;
