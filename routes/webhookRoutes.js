const express = require("express");
const axios = require("axios");
const User = require("../models/User"); // User Schema for MongoDB
const router = express.Router();
const crypto = require("crypto");
const SECRET_KEY =
  "06c56c0dc5225ecb346900570700cf9f6013f00b3da0490873f5f923c774d459";
router.post("/webhook/redington", (req, res) => {
  console.log("got webhook event");
  const signature = req.headers["x-signature"]; // Get signature from headers
  const projectId = req.headers["x-project-id"]; // Identify the project
  const payload = JSON.stringify(req.body);
  console.log(JSON.stringify(payload));

  // Verify the authenticity of the request
  const expectedSignature = crypto
    .createHmac("sha256", SECRET_KEY)
    .update(payload)
    .digest("hex");

  console.log("✅ Webhook received:", req.body);

  const { topic, data } = req.body;

  // Handle different webhook events
  switch (topic) {
    case "message.sender.user":
      console.log("📩 User sent a message to the business:", data);
      break;

    case "message.created":
      console.log("📨 New message created:", data);
      break;

    case "contact.created":
      console.log("👤 New contact created:", data);
      break;

    default:
      console.log("ℹ️ Unknown webhook topic:", topic);
  }

  res.sendStatus(200); // Acknowledge receipt
});
module.exports = router;
