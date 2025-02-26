const axios = require("axios");
const User = require("../models/User");
exports.getTemplates = async (req, res) => {
  const { kylasUserId } = req.params;

  if (!kylasUserId) return res.status(400).send("Kylas User ID is required.");

  try {
    // Step 1: Fetch User from Database
    const user = await User.findOne({ kylasUserId });

    if (!user || !user.projectId) {
      return res.status(404).send("User or Project ID not found.");
    }

    const projectId = user.projectId; // Get Project ID from Database

    // Step 2: Fetch Templates from Wapiy API
    const response = await axios.get(
      `https://apis.whatsapp.redingtongroup.com/project-apis/v1/project/${projectId}/wa_template/`,
      {
        headers: {
          "X-Partner-API-Key": process.env.WAPIY_PARTNER_API_KEY,
        },
      }
    );

    res.send(response.data);
  } catch (error) {
    console.error(
      "Error fetching templates:",
      error.response?.data || error.message
    );
    res.status(500).send("Failed to fetch templates.");
  }
};

exports.sendMessage = async (req, res) => {
  const { kylasUserId, to, message } = req.body;

  if (!kylasUserId || !to || !message)
    return res
      .status(400)
      .send("Kylas User ID, recipient number, and message are required.");

  try {
    // Fetch User from Database
    const user = await User.findOne({ kylasUserId });
    if (!user || !user.projectId)
      return res.status(404).send("User or Project ID not found.");

    // Send Message to Wapiy API
    const response = await axios.post(
      `https://apis.whatsapp.redingtongroup.com/project-apis/v1/project/${user.projectId}/messages`,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { body: message },
      },
      {
        headers: {
          "X-Partner-API-Key": process.env.WAPIY_PARTNER_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    res.send({
      message: "Message sent successfully!",
      response: response.data,
    });
  } catch (error) {
    console.error(
      "Error sending message:",
      error.response?.data || error.message
    );
    res.status(500).send("Failed to send message.");
  }
};

// 📌 Send Template Message
exports.sendTemplateMessage = async (req, res) => {
  const { kylasUserId, to, template } = req.body;

  if (!kylasUserId || !to || !template?.name || !template?.language)
    return res
      .status(400)
      .send(
        "Kylas User ID, recipient number, and template details are required."
      );

  try {
    // Fetch User from Database
    const user = await User.findOne({ kylasUserId });
    if (!user || !user.projectId)
      return res.status(404).send("User or Project ID not found.");

    // Send Template Message to Wapiy API
    const response = await axios.post(
      `https://apis.whatsapp.redingtongroup.com/project-apis/v1/project/${user.projectId}/messages`,
      {
        to,
        type: "template",
        recipient_type: "individual",
        template,
      },
      {
        headers: {
          "X-Partner-API-Key": process.env.WAPIY_PARTNER_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    res.status(200).send({
      message: "Template message sent successfully!",
      response: response.data,
    });
  } catch (error) {
    console.error(
      "Error sending template message:",
      error.response?.data || error.message
    );
    res.status(500).send("Failed to send template message.");
  }
};
