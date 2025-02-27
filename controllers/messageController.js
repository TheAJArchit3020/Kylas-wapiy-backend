const axios = require("axios");
const User = require("../models/User");
const API_WAPIY = "https://apis.whatsapp.redingtongroup.com";
const API_KYLAS = "https://api.kylas.io/v1";

// **1. Fetch Lead Details from Kylas**
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

// **2. Check or Create Contact in Wapiy**
exports.checkOrCreateContact = async (req, res) => {
  try {
    const { projectId, phoneNumber } = req.params;

    // Step 1: Check if contact exists in Wapiy
    const fetchResponse = await axios.get(
      `${API_WAPIY}/project-apis/v1/project/${projectId}/contact?action=FetchContact&mobile_number=${phoneNumber}`
    );

    let contact = fetchResponse.data;

    if (!contact) {
      // Step 2: Create contact if not found
      const createResponse = await axios.post(
        `${API_WAPIY}/project-apis/v1/project/${projectId}/contact`,
        { mobile_number: phoneNumber }
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
      error.response?.data || error
    );
    res.status(500).json({ error: "Failed to fetch/create contact" });
  }
};

// **3. Send Normal Message**
exports.sendMessage = async (req, res) => {
  try {
    const { to, message } = req.body;

    const payload = {
      to,
      type: "text",
      text: { body: message },
    };

    await axios.post(`${API_WAPIY}/project-apis/v1/messages`, payload);

    res.json({ message: "Message sent successfully!" });
  } catch (error) {
    console.error("Error sending message:", error.response?.data || error);
    res.status(500).json({ error: "Failed to send message." });
  }
};

// **4. Send Template Message**
exports.sendTemplateMessage = async (req, res) => {
  try {
    const { to, template } = req.body;

    const payload = {
      to,
      type: "template",
      template,
    };

    await axios.post(`${API_WAPIY}/project-apis/v1/messages`, payload);

    res.json({ message: "Template message sent successfully!" });
  } catch (error) {
    console.error(
      "Error sending template message:",
      error.response?.data || error
    );
    res.status(500).json({ error: "Failed to send template message." });
  }
};
