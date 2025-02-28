const express = require("express");
const {
  getLeadDetails,
  checkOrCreateContact,
  getTemplates,
  sendMessage,
  sendTemplateMessage,
} = require("../controllers/messageController");
const checkKylasAuth = require("../middleware/kylastokenMiddleware");
const router = express.Router();

router.get("/lead-details/:leadId/:userId", checkKylasAuth, getLeadDetails); // Fetch lead phone numbers
router.post("/check-or-create-contact", checkKylasAuth, checkOrCreateContact); // Check contact in Wapiy
router.post("/send-message", checkKylasAuth, sendMessage);
router.post("/send-template-message", checkKylasAuth, sendTemplateMessage);

module.exports = router;
