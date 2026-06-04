// routes/article-categories.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../middleware/auth");

// สร้างตารางถ้ายังไม่มี
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS article_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_th TEXT NOT NULL,
    name_en TEXT NOT NULL DEFAULT '',
    slug TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  )
`,
).run();

// seed default categories ถ้าตารางว่าง
const count = db
  .prepare("SELECT COUNT(*) as c FROM article_categories")
  .get().c;
if (count === 0) {
  const defaults = [
    { name_th: "ทั่วไป", name_en: "General", slug: "general" },
    { name_th: "การรักษา", name_en: "Treatment", slug: "treatment" },
    { name_th: "เตรียมตัว", name_en: "Preparation", slug: "preparation" },
    { name_th: "ความรู้ทั่วไป", name_en: "Medical Info", slug: "medical-info" },
    {
      name_th: "วางแผนอนาคต",
      name_en: "Family Planning",
      slug: "family-planning",
    },
  ];
  defaults.forEach((d, i) => {
    db.prepare(
      "INSERT INTO article_categories (name_th, name_en, slug, sort_order) VALUES (?,?,?,?)",
    ).run(d.name_th, d.name_en, d.slug, i + 1);
  });
}

// ── GET / — public
router.get("/", (req, res) => {
  const rows = db
    .prepare("SELECT * FROM article_categories ORDER BY sort_order ASC, id ASC")
    .all();
  res.json(rows);
});

// ── POST / — เพิ่ม
router.post("/", auth, (req, res) => {
  const { name_th, name_en = "", slug = "" } = req.body;
  if (!name_th?.trim())
    return res.status(400).json({ error: "กรุณากรอกชื่อหมวดหมู่ภาษาไทย" });

  const exists = db
    .prepare("SELECT id FROM article_categories WHERE name_th = ?")
    .get(name_th.trim());
  if (exists) return res.status(409).json({ error: "หมวดหมู่นี้มีอยู่แล้ว" });

  const maxOrder = db
    .prepare("SELECT MAX(sort_order) as m FROM article_categories")
    .get();
  const sort_order = (maxOrder?.m ?? 0) + 1;
  const autoSlug =
    slug.trim() ||
    name_th
      .trim()
      .toLowerCase()
      .replace(/[^\u0E00-\u0E7Fa-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");

  const result = db
    .prepare(
      "INSERT INTO article_categories (name_th, name_en, slug, sort_order) VALUES (?,?,?,?)",
    )
    .run(name_th.trim(), name_en.trim(), autoSlug, sort_order);

  res
    .status(201)
    .json(
      db
        .prepare("SELECT * FROM article_categories WHERE id = ?")
        .get(result.lastInsertRowid),
    );
});

// ── PUT /:id — แก้ไข
router.put("/:id", auth, (req, res) => {
  const { name_th, name_en, slug } = req.body;
  const cat = db
    .prepare("SELECT * FROM article_categories WHERE id = ?")
    .get(req.params.id);
  if (!cat) return res.status(404).json({ error: "ไม่พบหมวดหมู่" });
  if (!name_th?.trim())
    return res.status(400).json({ error: "กรุณากรอกชื่อหมวดหมู่ภาษาไทย" });

  const exists = db
    .prepare("SELECT id FROM article_categories WHERE name_th = ? AND id != ?")
    .get(name_th.trim(), req.params.id);
  if (exists) return res.status(409).json({ error: "หมวดหมู่นี้มีอยู่แล้ว" });

  db.prepare(
    `UPDATE article_categories SET name_th=?, name_en=?, slug=?, updated_at=datetime('now','localtime') WHERE id=?`,
  ).run(
    name_th.trim(),
    (name_en ?? cat.name_en).trim(),
    (slug ?? cat.slug).trim(),
    req.params.id,
  );

  res.json(
    db
      .prepare("SELECT * FROM article_categories WHERE id = ?")
      .get(req.params.id),
  );
});

// ── DELETE /:id — ลบ
router.delete("/:id", auth, (req, res) => {
  const cat = db
    .prepare("SELECT * FROM article_categories WHERE id = ?")
    .get(req.params.id);
  if (!cat) return res.status(404).json({ error: "ไม่พบหมวดหมู่" });
  db.prepare("DELETE FROM article_categories WHERE id = ?").run(req.params.id);
  res.json({ message: "ลบหมวดหมู่สำเร็จ" });
});

module.exports = router;
