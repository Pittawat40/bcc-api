// server.js - IVF Wellness CMS API
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 4002;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// Ensure upload directories exist
[
  "uploads/articles",
  "uploads/videos",
  "uploads/doctors",
  "uploads/stories",
  "uploads/gallery",
].forEach((dir) =>
  fs.mkdirSync(path.join(__dirname, dir), { recursive: true }),
);

// ─────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────
app.use(
  cors({
    origin: [
      FRONTEND_URL,
      "https://bcc-ivf.netlify.app",
      "http://localhost:3000",
      "http://localhost:4000",
    ],
    credentials: true,
  }),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/line", require("./routes/lineWebhook"));

// ─────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────
app.use("/api/auth", require("./routes/auth"));
app.use("/api/dashboard", require("./routes/dashboard"));
app.use("/api/articles", require("./routes/articles"));
app.use("/api/article-categories", require("./routes/article-categories"));
app.use("/api/videos", require("./routes/videos"));
app.use("/api/reviews", require("./routes/reviews"));
app.use("/api/review-categories", require("./routes/review-categories"));
app.use("/api/faqs", require("./routes/faqs"));
app.use("/api/faq-categories", require("./routes/faq-categories"));
app.use("/api/doctors", require("./routes/doctors"));
app.use("/api/settings", require("./routes/settings"));
app.use("/api/stories", require("./routes/stories"));
app.use("/api/appointments", require("./routes/appointments"));
app.use("/api/gallery", require("./routes/gallery"));

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", version: "2.0.0", time: new Date().toISOString() });
});

// ─────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 IVF Wellness API is running`);
  console.log(`   API:   http://localhost:${PORT}/api`);
  console.log(`\n   Default login: admin / admin1234\n`);
});
