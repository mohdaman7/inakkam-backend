const express = require('express');
const router = express.Router();
const { getMe, updateMe, completeOnboarding, uploadPhoto, deletePhoto, getUserById, getOnboardingOptions, getAgents, updateNotificationSound } = require('../controllers/userController');
const { protect } = require('../middlewares/auth');
const { uploadPhoto: multerPhoto } = require('../config/cloudinary');

router.use(protect);

router.get('/me', getMe);
router.get('/agents', getAgents);
router.get('/onboarding-options', getOnboardingOptions);
router.put('/me', updateMe);
router.route('/notification-sound')
    .get((req, res) => res.json({ success: true, notificationSound: req.user.notificationSound || 'default' }))
    .put(updateNotificationSound)
    .patch(updateNotificationSound)
    .post(updateNotificationSound);
router.route('/me/notification-sound')
    .put(updateNotificationSound)
    .patch(updateNotificationSound)
    .post(updateNotificationSound);
router.put('/me/onboarding', completeOnboarding);
router.post('/me/photos', multerPhoto.single('photo'), uploadPhoto);
router.delete('/me/photos/:photoId', deletePhoto);
router.get('/:id', getUserById);

module.exports = router;
