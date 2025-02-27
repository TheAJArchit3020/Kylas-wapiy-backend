const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Template = require("../models/Template");

// 📌 Save Template (First find the user, then store the template)
router.post("/save-template", async (req, res) => {
  try {
    const { userId, template } = req.body;

    if (!userId || !template) {
      return res
        .status(400)
        .json({ error: "User ID and template are required" });
    }

    // Step 1: Find the user using Kylas User ID
    const user = await User.findOne({ kylasUserId: userId });

    if (!user) {
      return res.status(404).json({ error: "User not found in the database" });
    }

    // Step 2: Check if the user already has templates
    let userTemplate = await Template.findOne({ userId: user._id });

    if (!userTemplate) {
      // Create a new entry if no templates exist for the user
      userTemplate = new Template({ userId: user._id, templates: [template] });
    } else {
      // Append new template to the user's existing template list
      userTemplate.templates.push(template);
    }

    await userTemplate.save();
    console.log(`Template saved for user ${user.kylasUserId}`);

    res.status(200).json({ message: "Template saved successfully" });
  } catch (error) {
    console.error("Error saving template:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 📌 Get Templates (Retrieve templates for a specific user)
router.get("/get-templates", async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    // Step 1: Find the user using Kylas User ID
    const user = await User.findOne({ kylasUserId: userId });

    if (!user) {
      return res.status(404).json({ error: "User not found in the database" });
    }

    // Step 2: Retrieve templates for the user
    const userTemplates = await Template.findOne({ userId: user._id });

    if (!userTemplates) {
      return res.status(200).json({ templates: [] }); // Return empty array if no templates exist
    }

    res.status(200).json({ templates: userTemplates.templates });
  } catch (error) {
    console.error("Error fetching templates:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
