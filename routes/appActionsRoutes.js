const express = require("express");
const axios = require("axios");
const User = require("../models/User"); // Import User Schema
const router = express.Router();

// 🔥 Handle Kylas App Actions (CLICK_TO_CALL & BULK_ACTION)
router.get("/appactions", async (req, res) => {
  try {
    const { location, userId, phoneNumber, tenantId } = req.query;
    const filters = req.body.filters ? JSON.parse(req.body.filters) : null; // Extract form data if BULK_ACTION

    // Check if Kylas User exists and is verified
    const user = await User.findOne({ kylasUserId: userId });
    if (!user || !user.verified) {
      return res.status(403).send("User not found or not verified.");
    }

    const projectId = user.projectId;
    if (!projectId) {
      return res.status(400).send("Project ID not found.");
    }

    // 📌 Handle CLICK_TO_CALL
    if (location === "CLICK_TO_CALL") {
      if (!phoneNumber) {
        return res.status(400).send("Phone number is required.");
      }

      // Check if contact exists in Wapiy CRM
      const contactResponse = await axios.get(
        `https://apis.whatsapp.redingtongroup.com/project-apis/v1/project/${projectId}/contact?action=FetchContact&mobile_number=${phoneNumber}`,
        {
          headers: {
            "X-Partner-API-Key": process.env.WAPIY_PARTNER_API_KEY,
          },
        }
      );

      // If contact does NOT exist, create it
      if (!contactResponse.data || contactResponse.data.length === 0) {
        await axios.post(
          `https://apis.whatsapp.redingtongroup.com/project-apis/v1/project/${projectId}/contact`,
          {
            name: "New Contact", // No name available in Click-to-Call
            mobile_number: phoneNumber,
          },
          {
            headers: {
              "X-Partner-API-Key": process.env.WAPIY_PARTNER_API_KEY,
              "Content-Type": "application/json",
            },
          }
        );
      }

      // Redirect to Wapiy CRM Contacts Page
      return res.redirect(
        `https://www.app.wapiy.ai/projects/${projectId}/contacts`
      );
    }

    // 📌 Handle BULK_ACTION
    if (location === "BULK_ACTION") {
      if (!filters || !filters.jsonRule || !filters.jsonRule.rules) {
        return res.status(400).send("Invalid form data.");
      }

      // Extract lead IDs from filters
      const leadIds = filters.jsonRule.rules
        .find((rule) => rule.field === "id")
        ?.value.split(",");

      if (!leadIds || leadIds.length === 0) {
        return res.status(400).send("No lead IDs found.");
      }

      // Iterate over each lead ID and check if contact exists
      for (const leadId of leadIds) {
        try {
          // Fetch lead details from Kylas API
          const kylasLeadResponse = await axios.get(
            `https://api.kylas.io/v1/leads/${leadId}`,
            {
              headers: {
                Authorization: `Bearer ${user.kylasAccessToken}`, // Kylas access token from DB
              },
            }
          );

          const { name, phoneNumbers } = kylasLeadResponse.data;
          if (!phoneNumbers || phoneNumbers.length === 0) continue; // Skip if no phone number

          const phoneNumber = phoneNumbers[0].value;

          // Check if contact exists in Wapiy CRM
          const contactResponse = await axios.get(
            `https://apis.whatsapp.redingtongroup.com/project-apis/v1/project/${projectId}/contact?action=FetchContact&mobile_number=${phoneNumber}`,
            {
              headers: {
                "X-Partner-API-Key": process.env.WAPIY_PARTNER_API_KEY,
              },
            }
          );

          // If contact does NOT exist, create it
          if (!contactResponse.data || contactResponse.data.length === 0) {
            await axios.post(
              `https://apis.whatsapp.redingtongroup.com/project-apis/v1/project/${projectId}/contact`,
              {
                name,
                mobile_number: phoneNumber,
              },
              {
                headers: {
                  "X-Partner-API-Key": process.env.WAPIY_PARTNER_API_KEY,
                  "Content-Type": "application/json",
                },
              }
            );
          }
        } catch (error) {
          console.error(
            `Error processing lead ${leadId}:`,
            error.response?.data || error.message
          );
        }
      }

      // Redirect to Wapiy CRM Contacts Page
      return res.redirect(
        `https://www.app.wapiy.ai/projects/${projectId}/contacts`
      );
    }

    return res.status(400).send("Invalid action.");
  } catch (error) {
    console.error("Error processing app action:", error);
    res.status(500).send("Internal server error.");
  }
});

module.exports = router;
