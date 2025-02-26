const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  kylasUserId: String,
  kylasAccessToken: String,
  kylasRefreshToken: String,
  expiresAt: Date,
  email: String,
  businessId: String,
  projectId: String,
  otp: String,
  otpExpiresAt: Date,
  verified: Boolean,
});

module.exports = mongoose.model("User", userSchema);
