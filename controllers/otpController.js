const axios = require("axios");
const User = require("../models/User");
const nodemailer = require("nodemailer");
const otpGenerator = require("otp-generator");

exports.sendOtp = async (req, res) => {
  const { email, kylasUserId } = req.body;
  if (!email || !kylasUserId)
    return res.status(400).send("Email and Kylas User ID are required.");

  try {
    const response = await axios.get(
      `https://apis.whatsapp.redingtongroup.com/partner-apis/v1/partner/${process.env.PARTNER_ID}/business`,
      {
        headers: {
          Accept: "application/json",
          "X-Partner-API-Key": process.env.WAPIY_PARTNER_API_KEY,
        },
      }
    );

    const businessList = response.data;
    const business = businessList.find((b) => b.email === email);
    if (!business)
      return res.status(404).send({ message: "Email not found in Wapiy." });

    const otp = otpGenerator.generate(6, { digits: true });
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

    await User.updateOne(
      { kylasUserId },
      {
        email,
        businessId: business.business_id,
        projectId: business.project_ids[0],
        otp,
        otpExpiresAt: otpExpiry,
      },
      { upsert: true }
    );

    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: true,
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
    console.error("OTP Error:", error.response?.data || error.message);
    res.status(500).send("Failed to process OTP.");
  }
};
exports.verifyOtp = async (req, res) => {
  const { email, otp, kylasUserId } = req.body;

  if (!email || !otp || !kylasUserId)
    return res.status(400).send("Email, OTP, and Kylas User ID are required.");

  try {
    // Step 1: Find User in Database
    const user = await User.findOne({ email, kylasUserId });
    if (!user) return res.status(404).send("User not found.");

    // Step 2: Validate OTP
    if (user.otp !== otp || user.otpExpiresAt < Date.now()) {
      return res.status(400).send("Invalid or expired OTP.");
    }

    // Step 3: Mark User as Verified and Clear OTP
    await User.updateOne(
      { email, kylasUserId },
      {
        $unset: { otp: 1, otpExpiresAt: 1 },
        verified: true,
      }
    );

    res.status(200).send({
      message: "OTP verified successfully! User is now verified.",
      businessId: user.businessId,
      projectId: user.projectId,
      verified: true,
    });
  } catch (error) {
    console.error(
      "Error verifying OTP:",
      error.response ? error.response.data : error.message
    );
    res.status(500).send("Failed to verify OTP.");
  }
};
