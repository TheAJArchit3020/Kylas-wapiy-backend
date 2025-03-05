const express = require("express");
const { kylasCallback, update_API } = require("../controllers/authController");
const router = express.Router();
if (!kylasCallback) {
  throw new Error("kylasCallback function is not defined in authController");
}
router.post("/kylas/callback", kylasCallback);
router.post("/update-api", update_API);
module.exports = router;
