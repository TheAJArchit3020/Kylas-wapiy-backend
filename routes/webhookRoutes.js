const express = require("express");
const axios = require("axios");
const User = require("../models/User"); // User Schema for MongoDB
const router = express.Router();
const crypto = require("crypto");
const SECRET_KEY =
  "7a322f1e4cfa17a93d7561534fa828a6aba7bc247770e3bfcc8c100aa38e916a";
router.post("/webhook/redington", async (req, res) => {
  console.log("got webhook event");
  let projectId;
  try {
    projectId = req.headers["x-project-id"]; // Identify the project
  } catch (error) {
    console.log(error.message);
    console.log(error);
  }

  if (!projectId) {
    return res.status(400).send("Missing Project ID");
  }
  console.log(projectId);
  let user;
  try {
    user = await User.findOne({ projectId });
  } catch (error) {
    console.log(error);
  }

  if (!user) throw new Error("User not found for given project ID");

  console.log("got the kylas user");
  const kylasAPIKey = user.kylasAPIKey;
  const kylasUserId = user.kylasUserId;

  const { topic, data } = req.body;
  console.log("✅ Webhook received:", req.body);

  // Handle different webhook events
  switch (topic) {
    case "message.sender.user":
      console.log("📩 User sent a message to the business:", data);

      const searchBody = {
        query: phoneNumber,
        fields: ["phoneNumbers"],
      };

      const leadSearchResponse = await axios.post(
        `${API_KYLAS}/search/lead?sort=updatedAt,desc&page=0&size=1`,
        searchBody,
        {
          headers: {
            "api-key": kylasAPIKey,
            "Content-Type": "application/json",
          },
        }
      );

      const leads = leadSearchResponse.data.content;

      console.log(leads);

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
