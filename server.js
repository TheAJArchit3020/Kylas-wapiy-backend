const express = require("express");
const connectDB = require("./config/db");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

connectDB();

app.use("/api", require("./routes/authRoutes"));
app.use("/api", require("./routes/otpRoutes"));
app.use("/api", require("./routes/messageRoutes"));
const appActionsRoutes = require("./routes/appActionsRoutes");
app.use("/api", appActionsRoutes);
app.listen(3000, () => console.log("✅ Server running on port 3000"));
