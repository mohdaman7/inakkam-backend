const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middlewares/auth');
const { uploadPhoto } = require('../config/cloudinary');

// Controllers
const adminAuthController = require('../controllers/admin/adminAuthController');
const adminStatsController = require('../controllers/admin/adminStatsController');
const adminUserController = require('../controllers/admin/adminUserController');
const adminInterestController = require('../controllers/admin/adminInterestController');
const adminLanguageController = require('../controllers/admin/adminLanguageController');
const adminReligionController = require('../controllers/admin/adminReligionController');
const adminRelationGoalController = require('../controllers/admin/adminRelationGoalController');
const adminFaqController = require('../controllers/admin/adminFaqController');
const adminPlanController = require('../controllers/admin/adminPlanController');
const adminPackageController = require('../controllers/admin/adminPackageController');
const adminStaffController = require('../controllers/admin/adminStaffController');
const adminPageController = require('../controllers/admin/adminPageController');
const adminReportController = require('../controllers/admin/adminReportController');
const adminPaymentController = require('../controllers/admin/adminPaymentController');
const adminFakeUserController = require('../controllers/admin/adminFakeUserController');
const adminNotificationController = require('../controllers/admin/adminNotificationController');
const adminGiftController = require('../controllers/admin/adminGiftController');
const verificationController = require('../controllers/verificationController');

// ─── Public Admin Routes ───────────────────────────────
router.post('/login', adminAuthController.login);

// ─── Private Admin Routes ( requireAdmin ) ──────────────
router.use(requireAdmin);

router.get('/me', adminAuthController.getMe);
router.put('/profile', uploadPhoto.single('avatar'), adminAuthController.updateProfile);
router.get('/stats', adminStatsController.getStats);

// Users
router.get('/users', adminUserController.getUsers);
router.patch('/users/:id/block', adminUserController.toggleBlockUser);

// Interests
router.get('/interests', adminInterestController.getInterests);
router.post('/interests', uploadPhoto.single('image'), adminInterestController.createInterest);
router.put('/interests/:id', uploadPhoto.single('image'), adminInterestController.updateInterest);
router.delete('/interests/:id', adminInterestController.deleteInterest);

// Languages
router.get('/languages', adminLanguageController.getLanguages);
router.post('/languages', uploadPhoto.single('image'), adminLanguageController.createLanguage);
router.put('/languages/:id', uploadPhoto.single('image'), adminLanguageController.updateLanguage);
router.delete('/languages/:id', adminLanguageController.deleteLanguage);

// Religions
router.get('/religions', adminReligionController.getReligions);
router.post('/religions', adminReligionController.createReligion);
router.put('/religions/:id', adminReligionController.updateReligion);
router.delete('/religions/:id', adminReligionController.deleteReligion);

// Gifts
router.get('/gifts', adminGiftController.getGifts);
router.post('/gifts', uploadPhoto.single('image'), adminGiftController.createGift);
router.put('/gifts/:id', uploadPhoto.single('image'), adminGiftController.updateGift);
router.delete('/gifts/:id', adminGiftController.deleteGift);

// Relation Goals
router.get('/relation-goals', adminRelationGoalController.getRelationGoals);
router.post('/relation-goals', adminRelationGoalController.createRelationGoal);
router.put('/relation-goals/:id', adminRelationGoalController.updateRelationGoal);
router.delete('/relation-goals/:id', adminRelationGoalController.deleteRelationGoal);

// FAQs
router.get('/faqs', adminFaqController.getFaqs);
router.post('/faqs', adminFaqController.createFaq);
router.put('/faqs/:id', adminFaqController.updateFaq);
router.delete('/faqs/:id', adminFaqController.deleteFaq);

// Plans
router.get('/plans', adminPlanController.getPlans);
router.post('/plans', adminPlanController.createPlan);
router.put('/plans/:id', adminPlanController.updatePlan);
router.delete('/plans/:id', adminPlanController.deletePlan);

// Packages
router.get('/packages', adminPackageController.getPackages);
router.post('/packages', adminPackageController.createPackage);
router.put('/packages/:id', adminPackageController.updatePackage);
router.delete('/packages/:id', adminPackageController.deletePackage);

// Staff
router.get('/staff', adminStaffController.getStaff);
router.post('/staff', adminStaffController.createStaff);
router.put('/staff/:id', adminStaffController.updateStaff);
router.delete('/staff/:id', adminStaffController.deleteStaff);

// Pages
router.get('/pages', adminPageController.getPages);
router.post('/pages', adminPageController.createPage);
router.put('/pages/:id', adminPageController.updatePage);
router.delete('/pages/:id', adminPageController.deletePage);

// Reports
router.get('/reports', adminReportController.getReports);
router.patch('/reports/:id/action', adminReportController.takeReportAction);

// Payments & Payouts
router.get('/payment-gateways', adminPaymentController.getPaymentGateways);
router.get('/payouts', adminPaymentController.getPayouts);
router.patch('/payouts/:id/process', adminPaymentController.processPayout);

// Fake Users
router.post('/fake-users', adminFakeUserController.generateFakeUsers);

// Push Notifications
router.post('/push-notification', uploadPhoto.single('image'), adminNotificationController.sendPushNotification);

// Verifications / KYC
router.get('/verifications', verificationController.getAllVerifications);
router.patch('/verifications/:id/status', verificationController.updateVerificationStatus);

module.exports = router;
