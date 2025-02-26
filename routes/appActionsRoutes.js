const express = require("express");
const router = express.Router();
const User = require("../models/User"); // Assuming user model is stored here

router.get("/appactions", async (req, res) => {
  try {
    const {
      tenantName,
      tenantId,
      actionId,
      userName,
      userId,
      entityId,
      entityType,
      actionName,
      location,
      userPhoneNumber,
      entityName,
      phoneNumber,
      phoneId,
      fieldName,
    } = req.query;

    if (!userId) return res.status(400).send("User ID missing!");

    // Step 1: Find the user in our database
    const user = await User.findOne({ kylasUserId: userId });
    if (!user) return res.status(401).send("Unauthorized user!");

    // Step 2: Construct Redirect URL (Modify as needed)
    const redirectUrl = `https://sendmessage.wapiy.ai/?leadPhone=${phoneNumber}&leadName=${entityName}&userPhone=${userPhoneNumber}&userName=${userName}&tenantId=${tenantId}`;

    // Step 3: Redirect the user within the iframe
    return res.redirect(redirectUrl);
  } catch (error) {
    console.error("App Actions Error:", error);
    res.status(500).send("Something went wrong.");
  }
});

module.exports = router;
