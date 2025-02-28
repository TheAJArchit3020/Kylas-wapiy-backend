const express = require("express");
const { kylasCallback } = require("../controllers/authController");
const router = express.Router();
if (!kylasCallback) {
  throw new Error("kylasCallback function is not defined in authController");
}
router.post("/kylas/callback", kylasCallback);

module.exports = router;
