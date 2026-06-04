// routes/review-categories.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../middleware/auth");

db.prepare(
  `
  CREATE TABLE IF NOT EXISTS review_categories (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name_th    TEXT NOT NULL,
    name_en    TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  )
`,
).run();

// seed defaults ถ้าว่าง
const count = db.prepare("SELECT COUNT(*) as c FROM review_categories").get().c;
if (count === 0) {
  const defaults = [
    { name_th: "IVF", name_en: "IVF" },
    { name_th: "IUI", name_en: "IUI" },
    { name_th: "ICSI", name_en: "ICSI" },
    { name_th: "PGT", name_en: "PGT" },
    { name_th: "ฝากไข่", name_en: "Egg Freezing" },
    { name_th: "ทั่วไป", name_en: "General" },
  ];
  defaults.forEach((d, i) => {
    db.prepare(
      "INSERT INTO review_categories (name_th, name_en, sort_order) VALUES (?,?,?)",
    ).run(d.name_th, d.name_en, i + 1);
  });
}

// GET / — public
router.get("/", (req, res) => {
  res.json(
    db
      .prepare(
        "SELECT * FROM review_categories ORDER BY sort_order ASC, id ASC",
      )
      .all(),
  );
});

// POST /
router.post("/", auth, (req, res) => {
  const { name_th, name_en = "" } = req.body;
  if (!name_th?.trim())
    return res.status(400).json({ error: "กรุณากรอกชื่อหมวดหมู่ภาษาไทย" });

  const exists = db
    .prepare("SELECT id FROM review_categories WHERE name_th = ?")
    .get(name_th.trim());
  if (exists) return res.status(409).json({ error: "หมวดหมู่นี้มีอยู่แล้ว" });

  const maxOrder = db
    .prepare("SELECT MAX(sort_order) as m FROM review_categories")
    .get();
  const sort_order = (maxOrder?.m ?? 0) + 1;

  const result = db
    .prepare(
      "INSERT INTO review_categories (name_th, name_en, sort_order) VALUES (?,?,?)",
    )
    .run(name_th.trim(), name_en.trim(), sort_order);
  res
    .status(201)
    .json(
      db
        .prepare("SELECT * FROM review_categories WHERE id = ?")
        .get(result.lastInsertRowid),
    );
});

// PUT /:id
router.put("/:id", auth, (req, res) => {
  const { name_th, name_en } = req.body;
  const cat = db
    .prepare("SELECT * FROM review_categories WHERE id = ?")
    .get(req.params.id);
  if (!cat) return res.status(404).json({ error: "ไม่พบหมวดหมู่" });
  if (!name_th?.trim())
    return res.status(400).json({ error: "กรุณากรอกชื่อหมวดหมู่ภาษาไทย" });

  const exists = db
    .prepare("SELECT id FROM review_categories WHERE name_th = ? AND id != ?")
    .get(name_th.trim(), req.params.id);
  if (exists) return res.status(409).json({ error: "หมวดหมู่นี้มีอยู่แล้ว" });

  db.prepare(
    `UPDATE review_categories SET name_th=?, name_en=?, updated_at=datetime('now','localtime') WHERE id=?`,
  ).run(name_th.trim(), (name_en ?? cat.name_en).trim(), req.params.id);

  res.json(
    db
      .prepare("SELECT * FROM review_categories WHERE id = ?")
      .get(req.params.id),
  );
});

// DELETE /:id
router.delete("/:id", auth, (req, res) => {
  const cat = db
    .prepare("SELECT * FROM review_categories WHERE id = ?")
    .get(req.params.id);
  if (!cat) return res.status(404).json({ error: "ไม่พบหมวดหมู่" });
  db.prepare("DELETE FROM review_categories WHERE id = ?").run(req.params.id);
  res.json({ message: "ลบหมวดหมู่สำเร็จ" });
});

module.exports = router;
