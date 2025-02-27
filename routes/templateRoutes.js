const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Template = require("../models/Template");

router.post("/save-template", async (req, res) => {
  try {
    const { userId, template } = req.body;

    if (!userId || !template) {
      return res
        .status(400)
        .json({ error: "User ID and template are required" });
    }

    // Find the user using Kylas User ID
    const user = await User.findOne({ kylasUserId: userId });
    if (!user) {
      return res.status(404).json({ error: "User not found in the database" });
    }

    // Check if the user already has templates
    let userTemplate = await Template.findOne({ userId: user._id });

    if (!userTemplate) {
      userTemplate = new Template({ userId: user._id, templates: [] });
    }

    // Ensure correct parameter structure
    const sanitizedTemplate = JSON.parse(JSON.stringify(template));

    sanitizedTemplate.components.forEach((component) => {
      if (component.parameters) {
        component.parameters = component.parameters.map((param) => {
          // Ensure type exists and format fields correctly
          const formattedParam = { type: param.type };

          if (param.type === "text") {
            formattedParam.text = param.text;
            formattedParam.fallback_value = param.fallback_value || "N/A";
          } else if (param.type === "image") {
            formattedParam.image = { link: param.image?.link };
          } else if (param.type === "video") {
            formattedParam.video = { link: param.video?.link };
          } else if (param.type === "document") {
            formattedParam.document = {
              link: param.document?.link,
              filename: param.document?.filename || "document.pdf",
            };
          }

          return formattedParam;
        });
      }
    });

    // Save the sanitized template
    userTemplate.templates.push(sanitizedTemplate);
    await userTemplate.save();

    console.log(`Template saved for user ${user.kylasUserId}`);
    res.status(200).json({ message: "Template saved successfully" });
  } catch (error) {
    console.error("Error saving template:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/delete-template", async (req, res) => {
  try {
    const { userId, templateName } = req.body;

    if (!userId || !templateName) {
      return res
        .status(400)
        .json({ error: "User ID and template name are required" });
    }

    // Step 1: Find the user using Kylas User ID
    const user = await User.findOne({ kylasUserId: userId });

    if (!user) {
      return res.status(404).json({ error: "User not found in the database" });
    }

    // Step 2: Find the user's template collection
    let userTemplate = await Template.findOne({ userId: user._id });

    if (!userTemplate) {
      return res
        .status(404)
        .json({ error: "No templates found for this user" });
    }

    // Step 3: Remove the template from the user's template list
    const updatedTemplates = userTemplate.templates.filter(
      (t) => t.name !== templateName
    );

    if (updatedTemplates.length === userTemplate.templates.length) {
      return res.status(404).json({ error: "Template not found" });
    }

    // Step 4: Save the updated template list
    userTemplate.templates = updatedTemplates;
    await userTemplate.save();

    console.log(
      `Template "${templateName}" deleted for user ${user.kylasUserId}`
    );
    res.status(200).json({ message: "Template deleted successfully" });
  } catch (error) {
    console.error("Error deleting template:", error);
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
