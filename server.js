require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const axios = require("axios");
const cors = require("cors");
const nodemailer = require("nodemailer");
const otpGenerator = require("otp-generator");

const app = express();
app.use(express.json());
app.use(cors());

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

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
});
const User = mongoose.model("User", userSchema);

// 📌 Step 1: Receive Kylas Auth Code & Fetch User Data
app.get("/api/kylas/callback", async (req, res) => {
  const authCode = req.query.code;
  if (!authCode) return res.status(400).send("Auth code missing!");

  try {
    // Exchange auth code for access token
    const response = await axios.post(
      "https://api.kylas.io/oauth/token",
      new URLSearchParams({
        grant_type: "authorization_code",
        code: authCode,
        redirect_uri: process.env.KYLAS_CALLBACK_URL,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization:
            "Basic " +
            Buffer.from(
              `${process.env.KYLAS_CLIENT_ID}:${process.env.KYLAS_CLIENT_SECRET}`
            ).toString("base64"),
        },
      }
    );

    const { access_token, refresh_token, expires_in } = response.data;
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    // Fetch Kylas user details
    const kylasUser = await axios.get("https://api.kylas.io/users/me", {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const kylasUserId = kylasUser.data.id;

    // Save Kylas user data
    await User.findOneAndUpdate(
      { kylasUserId },
      {
        kylasUserId,
        kylasAccessToken: access_token,
        kylasRefreshToken: refresh_token,
        expiresAt,
      },
      { upsert: true }
    );

    res.send({ message: "Kylas authentication successful!", kylasUserId });
  } catch (error) {
    console.error(
      "Kylas Auth Error:",
      error.response ? error.response.data : error.message
    );
    res.status(500).send("Kylas authentication failed.");
  }
});

// 📌 Step 2: Send OTP for Wapiy Authentication
app.post("/api/send-otp", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).send("Email is required.");

  try {
    // Step 1: Fetch Wapiy Business Profiles using API Key
    const response = await axios.get(
      `https://apis.whatsapp.redingtongroup.com/partner-apis/v1/partner/${process.env.PARTNER_ID}/business`,
      {
        headers: {
          Accept: "application/json",
          "X-Partner-API-Key": process.env.WAPIY_PARTNER_API_KEY, // Correct authentication header
        },
      }
    );

    // Step 2: Find Matching Business by Email
    const businessList = response.data; // List of all businesses
    const business = businessList.find((b) => b.email === email);

    if (!business) return res.status(404).send("Email not found in Wapiy.");

    // Step 3: Generate OTP
    const otp = otpGenerator.generate(6, {
      digits: true,
      alphabets: false,
      specialChars: false,
    });
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // OTP valid for 5 minutes

    // Step 4: Save OTP in Database
    await User.findOneAndUpdate(
      { email },
      {
        email,
        businessId: business.business_id,
        projectId:
          business.project_ids.length > 0 ? business.project_ids[0] : null, // Ensure project exists
        otp,
        otpExpiresAt: otpExpiry,
      },
      { upsert: true }
    );

    // Step 5: Send OTP via Email
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: true, // Use `true` for port 465, `false` for port 587
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"Wapiy Verification" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your OTP Code",
      text: `Your OTP code is: ${otp}`,
    });

    res.send("OTP sent successfully!");
  } catch (error) {
    console.error(
      "Error fetching Wapiy Business Profiles:",
      error.response ? error.response.data : error.message
    );
    res.status(500).send("Failed to fetch business details.");
  }
});

// 📌 Step 3: Verify OTP and Map User Data
app.post("/api/verify-otp", async (req, res) => {
  const { email, otp, kylasUserId } = req.body;
  if (!email || !otp || !kylasUserId)
    return res.status(400).send("Email, OTP, and Kylas User ID are required.");

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).send("User not found.");

    if (user.otp !== otp || user.otpExpiresAt < Date.now()) {
      return res.status(400).send("Invalid or expired OTP.");
    }

    // Clear OTP after verification and map to Kylas User
    await User.updateOne(
      { email },
      {
        kylasUserId,
        $unset: { otp: 1, otpExpiresAt: 1 },
      }
    );

    res.send({
      message: "User authenticated successfully!",
      businessId: user.businessId,
      projectId: user.projectId,
    });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.status(500).send("Failed to verify OTP.");
  }
});

// Start Server
app.listen(3000, () => console.log("Server running on port 3000"));
