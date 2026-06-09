// routes/auth.js
const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
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

  const accessToken = jwt.sign(
    { id: admin.id, username: admin.username },
    process.env.JWT_SECRET || "secret",
    { expiresIn: "15m" },
  );

  const refreshToken = uuidv4();
  const expiresAt = new Date(
    Date.now() + 30 * 24 * 60 * 60 * 1000,
  ).toISOString();

  db.prepare(
    "INSERT INTO refresh_tokens (admin_id, token, expires_at) VALUES (?, ?, ?)",
  ).run(admin.id, refreshToken, expiresAt);

  res.json({ accessToken, refreshToken, username: admin.username });
});

// POST /api/auth/refresh
router.post("/refresh", (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: "ไม่มี refreshToken" });
  }

  const row = db
    .prepare("SELECT * FROM refresh_tokens WHERE token = ?")
    .get(refreshToken);

  if (!row) {
    return res.status(403).json({ error: "refreshToken ไม่ถูกต้อง" });
  }

  if (new Date(row.expires_at) < new Date()) {
    db.prepare("DELETE FROM refresh_tokens WHERE token = ?").run(refreshToken);
    return res
      .status(403)
      .json({ error: "refreshToken หมดอายุ กรุณาเข้าสู่ระบบใหม่" });
  }

  const admin = db
    .prepare("SELECT * FROM admins WHERE id = ?")
    .get(row.admin_id);
  if (!admin) {
    return res.status(403).json({ error: "ไม่พบ admin" });
  }

  const accessToken = jwt.sign(
    { id: admin.id, username: admin.username },
    process.env.JWT_SECRET || "secret",
    { expiresIn: "15m" },
  );

  res.json({ accessToken });
});

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    db.prepare("DELETE FROM refresh_tokens WHERE token = ?").run(refreshToken);
  }
  res.json({ message: "ออกจากระบบแล้ว" });
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
