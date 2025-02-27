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
exports.getLeadDetails = async (req, res) => {
  try {
    const { leadId, userId } = req.params;

    // Find user to get their Kylas access token
    const user = await User.findOne({ kylasUserId: userId });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const kylasAccessToken = user.kylasAccessToken;
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

    res.json({ phoneNumbers });
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
    const { userId, phoneNumber } = req.params;

    // Get project ID from the user database
    const projectId = await getProjectId(userId);

    // Step 1: Check if contact exists in Wapiy
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

    let contact = fetchResponse.data;

    if (!contact || !contact.id) {
      // Step 2: Create contact if not found
      const createResponse = await axios.post(
        `${API_WAPIY}/project-apis/v1/project/${projectId}/contact`,
        { mobile_number: phoneNumber },
        {
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-Partner-API-Key": PARTNER_API_KEY,
          },
        }
      );
      contact = createResponse.data;
    }

    res.json({
      is_intervened: contact.is_intervened,
      is_requesting: contact.is_requesting,
    });
  } catch (error) {
    console.error(
      "Error fetching/creating contact:",
      error.response?.data || error.message
    );
    res.status(500).json({ error: "Failed to fetch/create contact" });
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

    res.json({ message: "Message sent successfully!" });
  } catch (error) {
    console.error(
      "Error sending message:",
      error.response?.data || error.message
    );
    res.status(500).json({ error: "Failed to send message." });
  }
};

// **3. Send Template Message**
exports.sendTemplateMessage = async (req, res) => {
  try {
    const { userId, to, template } = req.body;

    // Get project ID from the user database
    const projectId = await getProjectId(userId);

    const payload = {
      to,
      type: "template",
      template,
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

    res.json({ message: "Template message sent successfully!" });
  } catch (error) {
    console.error(
      "Error sending template message:",
      error.response?.data || error.message
    );
    res.status(500).json({ error: "Failed to send template message." });
  }
};
