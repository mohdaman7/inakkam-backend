const express = require('express');
const router = express.Router();
const { getConversations, getMessages, sendMessage } = require('../controllers/conversationController');
const { protect } = require('../middlewares/auth');

router.use(protect);
router.get('/', getConversations);
router.get('/:id/messages', getMessages);
router.post('/:id/messages', sendMessage);

module.exports = router;
