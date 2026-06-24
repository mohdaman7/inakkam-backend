const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const { upload } = require('../middlewares/uploadMiddleware');
const {
    submitVerification,
    getVerificationStatus,
    getAllVerifications,
    updateVerificationStatus,
} = require('../controllers/verificationController');

// ─── User Routes ────────────────────────────────────────
router.get('/status', protect, getVerificationStatus);

router.post(
    '/submit',
    protect,
    upload.fields([
        { name: 'aadhaarFront', maxCount: 1 },
        { name: 'aadhaarBack',  maxCount: 1 },
        { name: 'panCard',      maxCount: 1 },
        { name: 'selfieImage',  maxCount: 1 },
    ]),
    submitVerification
);

// ─── Admin Routes ───────────────────────────────────────
router.get('/admin/all',          protect, getAllVerifications);
router.patch('/admin/:id/status', protect, updateVerificationStatus);

module.exports = router;
