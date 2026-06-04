// routes/faq-categories.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../middleware/auth");

// สร้างตารางถ้ายังไม่มี
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS faq_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_th TEXT NOT NULL,
    name_en TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  )
`,
).run();

// ── GET / — public, ดึงทั้งหมด
router.get("/", (req, res) => {
  const rows = db
    .prepare("SELECT * FROM faq_categories ORDER BY sort_order ASC, id ASC")
    .all();
  res.json(rows);
});

// ── POST / — เพิ่มหมวดหมู่
router.post("/", auth, (req, res) => {
  const { name_th, name_en = "" } = req.body;
  if (!name_th?.trim())
    return res.status(400).json({ error: "กรุณากรอกชื่อหมวดหมู่ภาษาไทย" });

  // เช็ค duplicate
  const exists = db
    .prepare("SELECT id FROM faq_categories WHERE name_th = ?")
    .get(name_th.trim());
  if (exists) return res.status(409).json({ error: "หมวดหมู่นี้มีอยู่แล้ว" });

  const maxOrder = db
    .prepare("SELECT MAX(sort_order) as m FROM faq_categories")
    .get();
  const sort_order = (maxOrder?.m ?? 0) + 1;

  const result = db
    .prepare(
      "INSERT INTO faq_categories (name_th, name_en, sort_order) VALUES (?, ?, ?)",
    )
    .run(name_th.trim(), name_en.trim(), sort_order);

  res
    .status(201)
    .json(
      db
        .prepare("SELECT * FROM faq_categories WHERE id = ?")
        .get(result.lastInsertRowid),
    );
});

// ── PUT /:id — แก้ไขหมวดหมู่
router.put("/:id", auth, (req, res) => {
  const { name_th, name_en } = req.body;
  const cat = db
    .prepare("SELECT * FROM faq_categories WHERE id = ?")
    .get(req.params.id);
  if (!cat) return res.status(404).json({ error: "ไม่พบหมวดหมู่" });

  if (!name_th?.trim())
    return res.status(400).json({ error: "กรุณากรอกชื่อหมวดหมู่ภาษาไทย" });

  // เช็ค duplicate (ยกเว้น id ตัวเอง)
  const exists = db
    .prepare("SELECT id FROM faq_categories WHERE name_th = ? AND id != ?")
    .get(name_th.trim(), req.params.id);
  if (exists) return res.status(409).json({ error: "หมวดหมู่นี้มีอยู่แล้ว" });

  db.prepare(
    `UPDATE faq_categories SET name_th=?, name_en=?, updated_at=datetime('now','localtime') WHERE id=?`,
  ).run(name_th.trim(), (name_en ?? cat.name_en).trim(), req.params.id);

  res.json(
    db.prepare("SELECT * FROM faq_categories WHERE id = ?").get(req.params.id),
  );
});

// ── DELETE /:id — ลบหมวดหมู่
router.delete("/:id", auth, (req, res) => {
  const cat = db
    .prepare("SELECT * FROM faq_categories WHERE id = ?")
    .get(req.params.id);
  if (!cat) return res.status(404).json({ error: "ไม่พบหมวดหมู่" });

  db.prepare("DELETE FROM faq_categories WHERE id = ?").run(req.params.id);
  res.json({ message: "ลบหมวดหมู่สำเร็จ" });
});

module.exports = router;
