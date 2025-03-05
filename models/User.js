const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  kylasUserId: String,
  kylasAccessToken: String,
  kylasRefreshToken: String,
  expiresAt: Date,
  refreshTokenExpiresAt: Date,
  email: String,
  businessId: String,
  projectId: String,
  otp: String,
  otpExpiresAt: Date,
  verified: Boolean,
  kylasAPIKey: String,
});

module.exports = mongoose.model("User", userSchema);
