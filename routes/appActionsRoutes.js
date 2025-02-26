const express = require("express");
const axios = require("axios");
const User = require("../models/User"); // Import User Schema
const router = express.Router();

// 🔥 Handle Kylas App Actions (CLICK_TO_CALL & BULK_ACTION)
router.get("/appactions", async (req, res) => {
  try {
    console.log("➡️ Incoming App Action Request:", req.query);

    const { location, userId, phoneNumber, tenantId } = req.query;
    const filters = req.body.filters ? JSON.parse(req.body.filters) : null; // Extract form data if BULK_ACTION

    // 🛑 Check if Kylas User exists and is verified
    console.log("🔍 Checking Kylas User in DB:", userId);
    const user = await User.findOne({ kylasUserId: userId });

    if (!user || !user.verified) {
      console.log("❌ User not found or not verified:", userId);
      return res.status(403).send("User not found or not verified.");
    }

    const projectId = user.projectId;
    console.log("✅ User found, Project ID:", projectId);

    if (!projectId) {
      console.log("❌ Project ID not found in DB for user:", userId);
      return res.status(400).send("Project ID not found.");
    }

    // 📌 Handle CLICK_TO_CALL
    if (location === "CLICK_TO_CALL") {
      console.log("📞 CLICK_TO_CALL action triggered for phone:", phoneNumber);

      if (!phoneNumber) {
        console.log("❌ Phone number is missing in request.");
        return res.status(400).send("Phone number is required.");
      }

      try {
        console.log("🔍 Checking if contact exists in Wapiy CRM...");
        const contactResponse = await axios.get(
          `https://apis.whatsapp.redingtongroup.com/project-apis/v1/project/${projectId}/contact?action=FetchContact&mobile_number=${phoneNumber}`,
          {
            headers: {
              "X-Partner-API-Key": process.env.WAPIY_PARTNER_API_KEY,
            },
          }
        );
        console.log("✅ Contact check response:", contactResponse.data);

        // If contact does NOT exist, create it
        if (!contactResponse.data || contactResponse.data.length === 0) {
          console.log("🚀 Creating new contact in Wapiy CRM...");

          const createContactResponse = await axios.post(
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
          console.log(
            "✅ Contact created successfully:",
            createContactResponse.data
          );
        }

        console.log("🔄 Redirecting user to Wapiy Contacts Page...");
        return res.redirect(
          `https://www.app.wapiy.ai/projects/${projectId}/contacts`
        );
      } catch (error) {
        console.error(
          "❌ Error in CLICK_TO_CALL:",
          error.response?.data || error.message
        );
        return res
          .status(error.response?.status || 500)
          .send(error.response?.data || "Failed to fetch or create contact.");
      }
    }

    // 📌 Handle BULK_ACTION
    if (location === "BULK_ACTION") {
      console.log("📢 BULK_ACTION triggered");

      if (!filters || !filters.jsonRule || !filters.jsonRule.rules) {
        console.log("❌ Invalid form data received in BULK_ACTION.");
        return res.status(400).send("Invalid form data.");
      }

      // Extract lead IDs from filters
      const leadIds = filters.jsonRule.rules
        .find((rule) => rule.field === "id")
        ?.value.split(",");

      if (!leadIds || leadIds.length === 0) {
        console.log("❌ No lead IDs found in BULK_ACTION.");
        return res.status(400).send("No lead IDs found.");
      }

      console.log(`🔍 Processing ${leadIds.length} leads...`);

      for (const leadId of leadIds) {
        try {
          console.log(
            `📡 Fetching lead details from Kylas API for Lead ID: ${leadId}`
          );
          const kylasLeadResponse = await axios.get(
            `https://api.kylas.io/v1/leads/${leadId}`,
            {
              headers: {
                Authorization: `Bearer ${user.kylasAccessToken}`, // Kylas access token from DB
              },
            }
          );

          const { name, phoneNumbers } = kylasLeadResponse.data;
          console.log(
            `📋 Lead details: Name: ${name}, Phone Numbers:`,
            phoneNumbers
          );

          if (!phoneNumbers || phoneNumbers.length === 0) {
            console.log(
              `❌ No phone number found for Lead ID: ${leadId}, skipping...`
            );
            continue; // Skip if no phone number
          }

          const phoneNumber = phoneNumbers[0].value;

          console.log(
            `🔍 Checking if contact exists in Wapiy CRM for ${phoneNumber}`
          );
          const contactResponse = await axios.get(
            `https://apis.whatsapp.redingtongroup.com/project-apis/v1/project/${projectId}/contact?action=FetchContact&mobile_number=${phoneNumber}`,
            {
              headers: {
                "X-Partner-API-Key": process.env.WAPIY_PARTNER_API_KEY,
              },
            }
          );
          console.log("✅ Contact check response:", contactResponse.data);

          // If contact does NOT exist, create it
          if (!contactResponse.data || contactResponse.data.length === 0) {
            console.log(
              `🚀 Creating new contact in Wapiy CRM for ${phoneNumber}`
            );

            const createContactResponse = await axios.post(
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
            console.log(
              "✅ Contact created successfully:",
              createContactResponse.data
            );
          }
        } catch (error) {
          console.error(
            `❌ Error processing lead ${leadId}:`,
            error.response?.data || error.message
          );
        }
      }

      console.log("🔄 Redirecting user to Wapiy Contacts Page...");
      return res.redirect(
        `https://www.app.wapiy.ai/projects/${projectId}/contacts`
      );
    }

    console.log("❌ Invalid action received:", location);
    return res.status(400).send("Invalid action.");
  } catch (error) {
    console.error("❌ Error processing app action:", error);
    res.status(500).send("Internal server error.");
  }
});

module.exports = router;
