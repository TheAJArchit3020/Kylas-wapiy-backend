const express = require("express");
const axios = require("axios");
const User = require("../models/User"); // User Schema for MongoDB
const router = express.Router();

// 📌 Route: Get Projects for a Kylas User
router.get("/get-projects", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).send("Kylas User ID is required.");

    // Fetch Kylas User from our database
    const user = await User.findOne({ kylasUserId: userId });
    if (!user) return res.status(404).send("User not found.");
    if (!user.businessId) return res.status(400).send("Business ID not found.");

    console.log(`Fetching projects for Business ID: ${user.businessId}`);

    // Fetch list of projects from Redington API
    const response = await axios.get(
      `https://apis.whatsapp.redingtongroup.com/partner-apis/v1/partner/${process.env.PARTNER_ID}/business/${user.businessId}/projects`,
      {
        headers: {
          "X-Partner-API-Key": process.env.WAPIY_PARTNER_API_KEY,
        },
      }
    );

    const projects = response.data.projects || [];

    // Map project list & check if the project is already connected
    const formattedProjects = projects.map((project) => ({
      id: project.project_id,
      name: project.project_name,
      connected: user.projectId === project.project_id, // Check if the project is connected
    }));

    res.status(200).json({ projects: formattedProjects });
  } catch (error) {
    console.error(
      "Error fetching projects:",
      error.response?.data || error.message
    );
    res.status(500).send("Failed to fetch projects.");
  }
});

// 📌 Route: Connect a Project
router.post("/connect-project", async (req, res) => {
  try {
    const { userId, projectId } = req.body;
    if (!userId || !projectId)
      return res.status(400).send("User ID and Project ID are required.");

    // Find and update the Kylas user with the selected project ID
    const user = await User.findOneAndUpdate(
      { kylasUserId: userId },
      { projectId },
      { new: true }
    );

    if (!user) return res.status(404).send("User not found.");

    console.log(`User ${userId} connected to Project ID: ${projectId}`);

    res
      .status(200)
      .json({ message: "Project connected successfully!", projectId });
  } catch (error) {
    console.error(
      "Error connecting project:",
      error.response?.data || error.message
    );
    res.status(500).send("Failed to connect project.");
  }
});

module.exports = router;
