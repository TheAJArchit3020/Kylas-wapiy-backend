const axios = require("axios");
const User = require("../models/User");

const refreshKylasToken = async (userId) => {
  try {
    const user = await User.findOne({ kylasUserId: userId });

    if (!user) throw new Error("User not found");

    const currentTime = new Date();

    // Check if the refresh token has expired
    if (
      user.refreshTokenExpiresAt &&
      currentTime > user.refreshTokenExpiresAt
    ) {
      console.error("Refresh token expired. User needs to reauthorize.");
      throw new Error("Refresh token expired. Please reauthorize.");
    }

    // Check if the access token has expired
    if (user.expiresAt && currentTime > user.expiresAt) {
      console.log("Access token expired, refreshing...");

      const response = await axios.post(
        "https://api.kylas.io/oauth/token",
        new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: user.kylasRefreshToken,
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
      console.log("New access token generated:", access_token);

      const expiresAt = new Date(Date.now() + expires_in * 1000);
      const refreshTokenExpiresAt = new Date(
        Date.now() + 90 * 24 * 60 * 60 * 1000
      ); // 90 days

      await User.findOneAndUpdate(
        { kylasUserId: userId },
        {
          kylasAccessToken: access_token,
          kylasRefreshToken: refresh_token,
          expiresAt,
          refreshTokenExpiresAt,
        }
      );

      return access_token;
    }

    return user.kylasAccessToken;
  } catch (error) {
    console.error("Error refreshing Kylas access token:", error.message);
    throw error;
  }
};

// Middleware to check and refresh token before API calls
const checkKylasAuth = async (req, res, next) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "User ID is required" });

    const newAccessToken = await refreshKylasToken(userId);

    // Attach the fresh access token to the request
    req.kylasAccessToken = newAccessToken;
    next();
  } catch (error) {
    return res.status(401).json({ error: error.message });
  }
};

module.exports = checkKylasAuth;
