const express = require("express");
const axios = require("axios");
const User = require("../models/User"); // User Schema for MongoDB
const router = express.Router();
const crypto = require("crypto");

const API_KYLAS = "https://api.kylas.io/v1";
const SECRET_KEY =
  "7a322f1e4cfa17a93d7561534fa828a6aba7bc247770e3bfcc8c100aa38e916a";

const logMessageInKylas = async ({
  userId,
  leadId,
  messageContent,
  senderNumber,
  recipientNumber,
  attachments = [],
  recipientName,
}) => {
  try {
    const user = await User.findOne({ kylasUserId: userId });
    if (!user) throw new Error("User not found");

    const kylasAPIKey = user.kylasAPIKey;

    const payload = {
      content: messageContent,
      messageType: "whatsapp",
      ownerId: userId,
      senderNumber: Number(senderNumber),
      recipientNumber: Number(recipientNumber),
      direction: "incoming",
      sentAt: new Date().toISOString(),
      status: "delivered",
      recipients: [
        {
          entity: "lead",
          id: Number(leadId),
          phoneNumber: Number(recipientNumber),
          name: recipientName || "test",
        },
      ],
      relatedTo: [
        {
          entity: "lead",
          id: Number(leadId),
          name: recipientName || "test",
          phoneNumber: Number(recipientNumber),
        },
      ],
      attachments,
    };

    console.log(
      "📨 Logging message in Kylas:",
      JSON.stringify(payload, null, 2)
    );

    await axios.post(`${API_KYLAS}/messages`, payload, {
      headers: {
        "api-key": kylasAPIKey,
      },
    });

    console.log("✅ Message logged in Kylas CRM");
  } catch (error) {
    console.error(
      "❌ Error logging message in Kylas:",
      error.response?.data || error.message
    );
  }
};

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
      const message = data.message;
      const phoneNumber = message.phone_number;
      console.log("The Phone Number", phoneNumber);
      const userName = message.userName || "Unknown";
      const messageContentRaw = message.message_content || {};
      const messageText = message.message_content?.text || "No message content";
      console.log("📩 User sent a message to the business:", messageContentRaw);
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
      console.log("All the leads ", leads);

      if (leads.length === 0) {
        console.log("⚠️ No matching leads found in Kylas for:", phoneNumber);
        return res.sendStatus(200);
      }

      let messageContent = "New WhatsApp message";
      let attachments = [];

      if (messageContentRaw.text) {
        messageContent = messageContentRaw.text;
      } else if (messageContentRaw.caption && messageContentRaw.url) {
        messageContent = messageContentRaw.caption;
        attachments.push({
          fileName: "incoming-media.jpg",
          url: messageContentRaw.url,
        });
      }
      for (const lead of leads) {
        console.log("the lead: ", lead);
        const leadId = lead.id;
        const leadResponse = await axios.get(`${API_KYLAS}/leads/${leadId}`, {
          headers: {
            "api-key": kylasAPIKey,
            "Content-Type": "application/json",
          },
        });
        console.log("lead response", leadResponse.data);
        const leadName = `${lead.firstName || ""} ${
          lead.lastName || ""
        }`.trim();

        await logMessageInKylas({
          userId: kylasUserId,
          leadId,
          messageContent,
          senderNumber: phoneNumber,
          recipientNumber: phoneNumber,
          attachments,
          recipientName: leadName,
        });
      }

      break;

    default:
      console.log("ℹ️ Unknown webhook topic:", topic);
  }

  res.sendStatus(200); // Acknowledge receipt
});
module.exports = router;
