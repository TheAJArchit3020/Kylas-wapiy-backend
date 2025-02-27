const express = require("express");
const {
  getLeadDetails,
  checkOrCreateContact,
  getTemplates,
  sendMessage,
  sendTemplateMessage,
} = require("../controllers/messageController");

const router = express.Router();

router.get("/lead-details/:leadId/:userId", getLeadDetails); // Fetch lead phone numbers
router.post("/check-or-create-contact", checkOrCreateContact); // Check contact in Wapiy
router.post("/send-message", sendMessage);
router.post("/send-template-message", sendTemplateMessage);

module.exports = router;
