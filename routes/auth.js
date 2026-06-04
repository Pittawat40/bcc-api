// routes/auth.js
const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const db = require("../db");
const auth = require("../middleware/auth");

// POST /api/auth/login
router.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "กรุณากรอก username และ password" });
  }

  const admin = db
    .prepare("SELECT * FROM admins WHERE username = ?")
    .get(username);
  if (!admin) {
    return res.status(401).json({ error: "username หรือ password ไม่ถูกต้อง" });
  }

  const hashed = crypto.createHash("sha256").update(password).digest("hex");
  if (hashed !== admin.password) {
    return res.status(401).json({ error: "username หรือ password ไม่ถูกต้อง" });
  }

  const token = jwt.sign(
    { id: admin.id, username: admin.username },
    process.env.JWT_SECRET || "secret",
    { expiresIn: "7d" },
  );

  res.json({ token, username: admin.username });
});

// GET /api/auth/me
router.get("/me", auth, (req, res) => {
  res.json({ id: req.admin.id, username: req.admin.username });
});

// POST /api/auth/change-password
router.post("/change-password", auth, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "กรุณากรอกข้อมูลให้ครบ" });
  }

  const admin = db
    .prepare("SELECT * FROM admins WHERE id = ?")
    .get(req.admin.id);
  const hashedCurrent = crypto
    .createHash("sha256")
    .update(currentPassword)
    .digest("hex");

  if (hashedCurrent !== admin.password) {
    return res.status(401).json({ error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" });
  }

  const hashedNew = crypto
    .createHash("sha256")
    .update(newPassword)
    .digest("hex");
  db.prepare("UPDATE admins SET password = ? WHERE id = ?").run(
    hashedNew,
    req.admin.id,
  );

  res.json({ message: "เปลี่ยนรหัสผ่านสำเร็จ" });
});

module.exports = router;
