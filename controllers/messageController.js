const axios = require("axios");
const User = require("../models/User");
const API_WAPIY = "https://apis.whatsapp.redingtongroup.com";
const API_KYLAS = "https://api.kylas.io/v1";
const PARTNER_API_KEY = process.env.WAPIY_PARTNER_API_KEY;

// **1. Fetch Lead Details from Kylas**
const getSenderPhoneNumber = async (projectId) => {
  try {
    const response = await axios.get(
      `${API_WAPIY}/project-apis/v1/project/${projectId}`,
      {
        headers: { "X-Partner-API-Key": PARTNER_API_KEY },
      }
    );
    return response.data.wa_number || null;
  } catch (error) {
    console.error(
      "❌ Error fetching sender phone number:",
      error.response?.data || error.message
    );
    return null;
  }
};
const getProjectId = async (userId) => {
  const user = await User.findOne({ kylasUserId: userId });
  if (!user || !user.projectId) {
    throw new Error("Project ID not found for this user.");
  }
  return user.projectId;
};
const getTemplateIdFromRedington = async (projectId, templateName) => {
  try {
    const response = await axios.get(
      `${API_WAPIY}/project-apis/v1/project/${projectId}/wa_template/`,
      {
        headers: { "X-Partner-API-Key": PARTNER_API_KEY },
      }
    );

    const templates = response.data || [];
    const template = templates.find((t) => t.name === templateName);
    return template ? template.id : null;
  } catch (error) {
    console.error(
      "❌ Error fetching WA templates:",
      error.response?.data || error.message
    );
    return null;
  }
};

const getTemplateTextFromRedington = async (projectId, waTemplateId) => {
  try {
    const response = await axios.get(
      `${API_WAPIY}/project-apis/v1/project/${projectId}/wa_template/${waTemplateId}`,
      {
        headers: { "X-Partner-API-Key": PARTNER_API_KEY },
      }
    );

    return response.data.text || null;
  } catch (error) {
    console.error(
      "❌ Error fetching WA template details:",
      error.response?.data || error.message
    );
    return null;
  }
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
    try {
      await axios.post(`${API_KYLAS}/messages`, payload, {
        headers: {
          Authorization: `Bearer ${kylasAccessToken}`,
          "Content-Type": "application/json",
        },
      });
    } catch (error) {
      console.error("Error while logging in kylas", error);
    }

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
    const { userId, to, template, leadId } = req.body;
    const user = await User.findOne({ kylasUserId: userId });
    if (!user) return res.status(404).json({ error: "User not found" });

    const projectId = user.projectId;
    const senderNumber = await getSenderPhoneNumber(projectId);
    if (!senderNumber)
      return res
        .status(500)
        .json({ error: "Failed to fetch sender phone number" });

    // Fetch the WhatsApp template ID from Redington
    const waTemplateId = await getTemplateIdFromRedington(
      projectId,
      template.name
    );
    if (!waTemplateId)
      return res.status(404).json({ error: "WhatsApp template not found" });

    // Fetch the actual template text from Redington
    let messageContent = await getTemplateTextFromRedington(
      projectId,
      waTemplateId
    );
    if (!messageContent)
      return res.status(500).json({ error: "Failed to fetch template text" });

    // Fetch lead details from Kylas API
    const leadResponse = await axios.get(`${API_KYLAS}/leads/${leadId}`, {
      headers: { Authorization: `Bearer ${user.kylasAccessToken}` },
    });

    const leadData = leadResponse.data;
    const leadName = `${leadData.firstName || ""} ${
      leadData.lastName || ""
    }`.trim();
    const companyName = leadData.companyName || "N/A";

    // Clone the template object to avoid modifying the original
    const sanitizedTemplate = JSON.parse(JSON.stringify(template));
    delete sanitizedTemplate.type;

    let attachments = [];
    let parameterValues = [];

    // Replace placeholders dynamically in components
    sanitizedTemplate.components.forEach((component) => {
      if (component.parameters) {
        component.parameters.forEach((param, index) => {
          if (param.type === "text") {
            const value = param.text === "lead_name" ? leadName : companyName;
            parameterValues.push(value);
          } else if (param.type === "image") {
            attachments.push({ fileName: "image.jpg", url: param.image?.link });
          } else if (param.type === "video") {
            attachments.push({ fileName: "video.mp4", url: param.video?.link });
          } else if (param.type === "document") {
            attachments.push({
              fileName: param.document?.filename || "document.pdf",
              url: param.document?.link,
            });
          }
        });
      }
    });

    // Replace placeholders {{1}}, {{2}}, etc. in the message text
    messageContent = messageContent.replace(/{{(\d+)}}/g, (match, number) => {
      return parameterValues[number - 1] || match;
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
