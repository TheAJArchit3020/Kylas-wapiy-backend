const express = require("express");
const {
  getTemplates,
  sendMessage,
  sendTemplateMessage,
} = require("../controllers/messageController");
const router = express.Router();

router.get("/templates/:kylasUserId", getTemplates);
router.post("/send-message", sendMessage);
router.post("/send-template-message", sendTemplateMessage);
module.exports = router;
