const axios = require("axios");
const User = require("../models/User");

exports.kylasCallback = async (req, res) => {
  const { authCode } = req.body;
  if (!authCode) return res.status(400).send("Auth code missing!");

  try {
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

    const kylasUser = await axios.get("https://api.kylas.io/v1/users/me", {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const kylasUserId = kylasUser.data.id;

    // Save or update the user in the database
    const user = await User.findOneAndUpdate(
      { kylasUserId },
      {
        kylasUserId,
        kylasAccessToken: access_token,
        kylasRefreshToken: refresh_token,
        expiresAt,
        verified: false,
      },
      { upsert: true, new: true }
    );

    res.send({ message: "Kylas authentication successful!", kylasUserId });
  } catch (error) {
    console.error("Kylas Auth Error:", error.response?.data || error.message);
    res.status(500).send("Kylas authentication failed.");
  }
};
