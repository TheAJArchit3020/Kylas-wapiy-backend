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
  verified: Boolean,
});
const User = mongoose.model("User", userSchema);

// 📌 Step 1: Receive Kylas Auth Code & Fetch User Data
app.post("/api/kylas/callback", async (req, res) => {
  const authCode = req.body.authCode;
  console.log(authCode);
  if (!authCode) return res.status(400).send("Auth code missing!");

  try {
    // Exchange auth code for access token
    const response = await axios.post(
      "https://api.kylas.io/oauth/token",
      new URLSearchParams({
        grant_type: "authorization_code",
        code: authCode,
        redirect_uri: "https://api.wapiy.ai/",
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
    console.log(access_token);
    // Fetch Kylas user details
    const kylasUser = await axios.get("https://api.kylas.io/v1/users/me", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    console.log(kylasUser.data.id);
    const kylasUserId = kylasUser.data.id;

    // Check if the user already exists, create or update as necessary
    const existingUser = await User.findOne({ kylasUserId });
    if (!existingUser) {
      // Create a new user
      await User.create({
        kylasUserId,
        kylasAccessToken: access_token,
        kylasRefreshToken: refresh_token,
        expiresAt,
        businessId: null, // Initialize with null if applicable
        projectId: null, // Initialize with null if applicable
        verified: false,
      });
    } else {
      // Update existing user
      await User.findOneAndUpdate(
        { kylasUserId },
        {
          kylasAccessToken: access_token,
          kylasRefreshToken: refresh_token,
          expiresAt,
        },
        { upsert: true }
      );
    }

    // Send Kylas User ID to frontend
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
  const { email, kylasUserId } = req.body;
  if (!email || !kylasUserId)
    return res.status(400).send("Email and Kylas User ID are required.");

  try {
    // Step 1: Fetch Wapiy Business Profiles using API Key
    const response = await axios.get(
      `https://apis.whatsapp.redingtongroup.com/partner-apis/v1/partner/${process.env.PARTNER_ID}/business`,
      {
        headers: {
          Accept: "application/json",
          "X-Partner-API-Key": process.env.WAPIY_PARTNER_API_KEY,
        },
      }
    );

    // Step 2: Find Matching Business by Email
    const businessList = response.data;
    const business = businessList.find((b) => b.email === email);
    if (!business)
      return res.status(404).send({ message: "Email not found in Wapiy." });

    // Step 3: Update the User's Kylas Info in the Database
    const user = await User.findOneAndUpdate(
      { kylasUserId },
      {
        email,
        businessId: business.business_id,
        projectId:
          business.project_ids.length > 0 ? business.project_ids[0] : null, // Ensure project exists
      },
      { upsert: true }
    );

    // Step 4: Generate OTP
    const otp = otpGenerator.generate(6, {
      digits: true,
      alphabets: false,
      specialChars: false,
    });
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // OTP valid for 5 minutes

    // Step 5: Save OTP in Database
    await User.updateOne(
      { email },
      {
        otp,
        otpExpiresAt: otpExpiry,
      }
    );

    // Step 6: Send OTP via Email
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

    res.status(201).send({ message: "OTP sent successfully!" });
  } catch (error) {
    console.error(
      "Error processing OTP:",
      error.response ? error.response.data : error.message
    );
    res.status(500).send("Failed to process OTP.");
  }
});

// 📌 Step 3: Verify OTP and Map User Data
app.post("/api/verify-otp", async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp)
    return res.status(400).send("Email, OTP, and Kylas User ID are required.");

  try {
    // Step 1: Verify OTP and Check Kylas User in Database
    const user = await User.findOne({ email });
    if (!user) return res.status(404).send("User not found.");

    if (user.otp !== otp || user.otpExpiresAt < Date.now()) {
      return res.status(400).send("Invalid or expired OTP.");
    }

    // Step 2: Clear OTP and Authenticate User
    await User.updateOne(
      { email },
      {
        $unset: { otp: 1, otpExpiresAt: 1 },
        verified: true,
      }
    );

    res.send({
      message: "User authenticated successfully!",
      businessId: user.businessId,
      projectId: user.projectId,
    });
  } catch (error) {
    console.error(
      "Error verifying OTP:",
      error.response ? error.response.data : error.message
    );
    res.status(500).send("Failed to verify OTP.");
  }
});

// Start Server
app.listen(3000, "0.0.0.0", () => console.log("Server running on port 3000"));
