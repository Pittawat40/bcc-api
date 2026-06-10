// routes/auth.js
const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const db = require("../db");
const auth = require("../middleware/auth");

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("JWT_SECRET is not set in environment");

function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function generateAccessToken(admin) {
  return jwt.sign({ id: admin.id, username: admin.username }, JWT_SECRET, {
    expiresIn: "15m",
  });
}

function generateRefreshToken() {
  return uuidv4();
}

function saveRefreshToken(adminId, token) {
  const expiresAt = new Date(
    Date.now() + 30 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const result = db
    .prepare(
      "INSERT INTO refresh_tokens (admin_id, token, expires_at) VALUES (?, ?, ?)",
    )
    .run(adminId, token, expiresAt);

  if (result.changes !== 1) {
    throw new Error("Failed to save refresh token");
  }
}

// ลบ expired tokens ทิ้ง (เรียกหลัง login/refresh)
function cleanupExpiredTokens() {
  db.prepare("DELETE FROM refresh_tokens WHERE expires_at < ?").run(
    new Date().toISOString(),
  );
}

// POST /api/auth/login
router.post("/login", (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "กรุณากรอก username และ password" });
    }

    const admin = db
      .prepare("SELECT * FROM admins WHERE username = ?")
      .get(username);

    if (!admin || hashPassword(password) !== admin.password) {
      return res
        .status(401)
        .json({ error: "username หรือ password ไม่ถูกต้อง" });
    }

    const accessToken = generateAccessToken(admin);
    const refreshToken = generateRefreshToken();

    saveRefreshToken(admin.id, refreshToken);
    cleanupExpiredTokens();

    return res.json({ accessToken, refreshToken, username: admin.username });
  } catch (err) {
    console.error("[login error]", err);
    return res.status(500).json({ error: "เกิดข้อผิดพลาด กรุณาลองใหม่" });
  }
});

// POST /api/auth/refresh
router.post("/refresh", (req, res) => {
  try {
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
      db.prepare("DELETE FROM refresh_tokens WHERE token = ?").run(
        refreshToken,
      );
      return res
        .status(403)
        .json({ error: "refreshToken หมดอายุ กรุณาเข้าสู่ระบบใหม่" });
    }

    const admin = db
      .prepare("SELECT * FROM admins WHERE id = ?")
      .get(row.admin_id);

    if (!admin) {
      db.prepare("DELETE FROM refresh_tokens WHERE token = ?").run(
        refreshToken,
      );
      return res.status(403).json({ error: "ไม่พบ admin" });
    }

    // Token rotation: ลบอันเก่า ออก token ใหม่
    db.prepare("DELETE FROM refresh_tokens WHERE token = ?").run(refreshToken);

    const newAccessToken = generateAccessToken(admin);
    const newRefreshToken = generateRefreshToken();

    saveRefreshToken(admin.id, newRefreshToken);
    cleanupExpiredTokens();

    return res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    console.error("[refresh error]", err);
    return res.status(500).json({ error: "เกิดข้อผิดพลาด กรุณาลองใหม่" });
  }
});

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      db.prepare("DELETE FROM refresh_tokens WHERE token = ?").run(
        refreshToken,
      );
    }
    return res.json({ message: "ออกจากระบบแล้ว" });
  } catch (err) {
    console.error("[logout error]", err);
    return res.status(500).json({ error: "เกิดข้อผิดพลาด" });
  }
});

// GET /api/auth/me
router.get("/me", auth, (req, res) => {
  return res.json({ id: req.admin.id, username: req.admin.username });
});

// POST /api/auth/change-password
router.post("/change-password", auth, (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "กรุณากรอกข้อมูลให้ครบ" });
    }

    const admin = db
      .prepare("SELECT * FROM admins WHERE id = ?")
      .get(req.admin.id);

    if (!admin || hashPassword(currentPassword) !== admin.password) {
      return res.status(401).json({ error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" });
    }

    db.prepare("UPDATE admins SET password = ? WHERE id = ?").run(
      hashPassword(newPassword),
      req.admin.id,
    );

    return res.json({ message: "เปลี่ยนรหัสผ่านสำเร็จ" });
  } catch (err) {
    console.error("[change-password error]", err);
    return res.status(500).json({ error: "เกิดข้อผิดพลาด" });
  }
});

module.exports = router;
