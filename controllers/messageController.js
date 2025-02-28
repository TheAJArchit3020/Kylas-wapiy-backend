const axios = require("axios");
const User = require("../models/User");
const API_WAPIY = "https://apis.whatsapp.redingtongroup.com";
const API_KYLAS = "https://api.kylas.io/v1";
const PARTNER_API_KEY = process.env.WAPIY_PARTNER_API_KEY;

// **1. Fetch Lead Details from Kylas**

const getProjectId = async (userId) => {
  const user = await User.findOne({ kylasUserId: userId });
  if (!user || !user.projectId) {
    throw new Error("Project ID not found for this user.");
  }
  return user.projectId;
};

/**
 * Function to refresh the Kylas access token
 */
const refreshAccessToken = async (user) => {
  try {
    console.log(`🔄 Refreshing access token for user ${user.kylasUserId}`);

    const response = await axios.post(
      "https://api.kylas.io/oauth/token",
      new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: user.kylasRefreshToken,
        client_id: process.env.KYLAS_CLIENT_ID, // Set this in .env
        client_secret: process.env.KYLAS_CLIENT_SECRET, // Set this in .env
      }).toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const { access_token, refresh_token, expires_in } = response.data;

    // Update the user's access token in the database
    user.kylasAccessToken = access_token;
    user.kylasRefreshToken = refresh_token; // Store the new refresh token
    user.expiresAt = new Date(Date.now() + expires_in * 1000); // Calculate new expiry time
    await user.save();

    console.log(`✅ New access token saved for user ${user.kylasUserId}`);

    return access_token;
  } catch (error) {
    console.error(
      "❌ Failed to refresh access token:",
      error.response?.data || error.message
    );
    throw new Error("Failed to refresh access token");
  }
};

/**
 * Function to fetch lead details
 */
exports.getLeadDetails = async (req, res) => {
  try {
    const { leadId, userId } = req.params;

    // Find user in the database
    let user = await User.findOne({ kylasUserId: userId });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    let kylasAccessToken = user.kylasAccessToken;

    // Check if the token is expired
    if (!user.expiresAt || new Date() >= user.expiresAt) {
      try {
        kylasAccessToken = await refreshAccessToken(user); // Refresh token if expired
      } catch (refreshError) {
        return res
          .status(401)
          .json({ error: "Authentication failed. Please reconnect Kylas." });
      }
    }

    // Fetch lead details
    const response = await axios.get(`${API_KYLAS}/leads/${leadId}`, {
      headers: {
        Authorization: `Bearer ${kylasAccessToken}`,
      },
    });

    const leadData = response.data;

    if (!leadData || !leadData.phoneNumbers) {
      return res.status(404).json({ error: "No phone numbers found" });
    }

    // Extract phone numbers
    const phoneNumbers = leadData.phoneNumbers.map((phone) => ({
      type: phone.type,
      number: phone.value,
      dialCode: phone.dialCode,
    }));

    // Extract lead name (firstName + lastName)
    const leadName = `${leadData.firstName || ""} ${
      leadData.lastName || ""
    }`.trim();

    res.json({ phoneNumbers, leadName });
  } catch (error) {
    console.error(
      "Error fetching lead details:",
      error.response?.data || error
    );
    res.status(500).json({ error: "Failed to fetch lead details" });
  }
};

exports.checkOrCreateContact = async (req, res) => {
  try {
    const { userId, phoneNumber, name } = req.body; // Accept name in request body

    // Get project ID from the user database
    const projectId = await getProjectId(userId);

    let contact = null;

    // Step 1: Check if contact exists in Wapiy
    try {
      const fetchResponse = await axios.get(
        `${API_WAPIY}/project-apis/v1/project/${projectId}/contact?action=FetchContact&mobile_number=${phoneNumber}`,
        {
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-Partner-API-Key": PARTNER_API_KEY,
          },
        }
      );
      contact = fetchResponse.data;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log("Contact not found. Creating a new one...");

        // Step 2: Create contact if not found
        const createResponse = await axios.post(
          `${API_WAPIY}/project-apis/v1/project/${projectId}/contact`,
          { mobile_number: phoneNumber, name: name || "Unknown" }, // Send name
          {
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              "X-Partner-API-Key": PARTNER_API_KEY,
            },
          }
        );
        contact = createResponse.data;
      } else {
        console.error(
          "Error fetching contact:",
          error.response?.data || error.message
        );
        return res.status(500).json({ error: "Failed to fetch contact" });
      }
    }

    res.json({
      is_intervened: contact.is_intervened,
      is_requesting: contact.is_requesting,
    });
  } catch (error) {
    console.error(
      "Error in checkOrCreateContact:",
      error.response?.data || error.message
    );
    res.status(500).json({ error: "Failed to fetch/create contact" });
  }
};

const logMessageInKylas = async ({
  userId,
  leadId,
  messageContent,
  senderNumber,
  recipientNumber,
  attachments = [],
}) => {
  try {
    const user = await User.findOne({ kylasUserId: userId });

    if (!user) throw new Error("User not found");

    // Use the current Kylas Access Token
    let kylasAccessToken = user.kylasAccessToken;

    // Prepare message log payload
    const payload = {
      content: messageContent,
      medium: "whatsapp",
      senderNumber,
      recipientNumber,
      direction: "outgoing",
      sentAt: new Date().toISOString(),
      status: "sent",
      recipients: [
        {
          entity: "lead",
          id: leadId,
          name: "Lead", // Name can be fetched dynamically if needed
          phoneNumber: recipientNumber,
        },
      ],
      relatedTo: [
        {
          entity: "lead",
          id: leadId,
          name: "Lead",
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
        Authorization: `Bearer ${kylasAccessToken}`,
        "Content-Type": "application/json",
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
// **2. Send Normal Message**
exports.sendMessage = async (req, res) => {
  try {
    const { userId, to, message } = req.body;

    // Get project ID from the user database
    const projectId = await getProjectId(userId);

    const payload = {
      to,
      type: "text",
      text: { body: message },
    };

    await axios.post(
      `${API_WAPIY}/project-apis/v1/project/${projectId}/messages`,
      payload,
      {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Partner-API-Key": PARTNER_API_KEY,
        },
      }
    );
    await logMessageInKylas({
      userId,
      leadId,
      messageContent: message,
      senderNumber,
      recipientNumber: to,
    });
    res.json({ message: "Message sent successfully!" });
  } catch (error) {
    console.error(
      "Error sending message:",
      error.response?.data || error.message
    );
    res.status(500).json({ error: "Failed to send message." });
  }
};

exports.sendTemplateMessage = async (req, res) => {
  try {
    const { userId, to, template, leadId, senderNumber } = req.body;

    // Get project ID
    const projectId = await getProjectId(userId);

    // Find user in DB
    const user = await User.findOne({ kylasUserId: userId });
    if (!user) return res.status(404).json({ error: "User not found" });

    // Fetch lead details from Kylas API
    const kylasAccessToken = user.kylasAccessToken;
    const leadResponse = await axios.get(`${API_KYLAS}/leads/${leadId}`, {
      headers: { Authorization: `Bearer ${kylasAccessToken}` },
    });

    const leadData = leadResponse.data;
    const leadName = `${leadData.firstName || ""} ${
      leadData.lastName || ""
    }`.trim();
    const companyName = leadData.companyName || "N/A";

    // Clone the template object to avoid modifying the original
    const sanitizedTemplate = JSON.parse(JSON.stringify(template));

    // Remove unwanted `type` field inside the template object
    delete sanitizedTemplate.type;

    let messageContent = "";
    let attachments = [];

    // Replace placeholders dynamically in components
    sanitizedTemplate.components.forEach((component) => {
      if (component.parameters) {
        component.parameters = component.parameters.map((param) => {
          const formattedParam = { type: param.type };

          if (param.type === "text") {
            formattedParam.text =
              param.text === "lead_name" ? leadName : companyName;
            messageContent += ` ${formattedParam.text}`; // Construct message for Kylas
          } else if (param.type === "image") {
            formattedParam.image = { link: param.image?.link };
            attachments.push({
              fileName: "image.jpg",
              url: param.image?.link,
            });
          } else if (param.type === "video") {
            formattedParam.video = { link: param.video?.link };
            attachments.push({
              fileName: "video.mp4",
              url: param.video?.link,
            });
          } else if (param.type === "document") {
            formattedParam.document = {
              link: param.document?.link,
              filename: param.document?.filename || "document.pdf",
            };
            attachments.push({
              fileName: param.document?.filename || "document.pdf",
              url: param.document?.link,
            });
          }

          return formattedParam;
        });
      }
    });

    // Prepare final payload for WhatsApp API
    const payload = {
      to,
      type: "template",
      template: sanitizedTemplate,
    };

    console.log(
      "🚀 Sending Template WhatsApp Message:",
      JSON.stringify(payload, null, 2)
    );

    // Send template message to WhatsApp API
    await axios.post(
      `${API_WAPIY}/project-apis/v1/project/${projectId}/messages`,
      payload,
      {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Partner-API-Key": PARTNER_API_KEY,
        },
      }
    );

    console.log("✅ Template message sent successfully!");

    // Log the template message in Kylas CRM with attachments
    await logMessageInKylas({
      userId,
      leadId,
      messageContent,
      senderNumber,
      recipientNumber: to,
      attachments,
    });

    res.json({ message: "Template message sent successfully!" });
  } catch (error) {
    console.error(
      "❌ Error sending template message:",
      error.response?.data || error.message
    );
    res.status(500).json({ error: "Failed to send template message." });
  }
};
