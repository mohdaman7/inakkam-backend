const express = require('express');
const router = express.Router();
const { getConversations, getMessages, sendMessage, deleteMessage } = require('../controllers/conversationController');
const { protect } = require('../middlewares/auth');

router.use(protect);
router.get('/', getConversations);
router.get('/:id/messages', getMessages);
router.post('/:id/messages', sendMessage);
router.delete('/:id/messages/:messageId', deleteMessage);

module.exports = router;
