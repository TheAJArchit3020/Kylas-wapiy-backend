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
const projectRoutes = require("./routes/projectRoutes");
app.use("/api", projectRoutes);
app.listen(3000, () => console.log("✅ Server running on port 3000"));
