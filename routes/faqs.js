// routes/faqs.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../middleware/auth");

// ── Public ────────────────────────────────────────────────
router.get("/", (req, res) => {
  const rows = db
    .prepare(
      `
    SELECT f.*,
           COALESCE(fc.name_en, f.category) AS category_en
    FROM faqs f
    LEFT JOIN faq_categories fc ON fc.name_th = f.category
    WHERE f.status = 'published'
    ORDER BY f.category, f.sort_order ASC
  `,
    )
    .all();

  const grouped = {};
  rows.forEach((faq) => {
    if (!grouped[faq.category]) {
      grouped[faq.category] = {
        category: faq.category,
        category_en: faq.category_en,
        items: [],
      };
    }
    grouped[faq.category].items.push({
      id: faq.id,
      q: faq.question,
      qEn: faq.question_en || faq.question,
      a: faq.answer,
      aEn: faq.answer_en || faq.answer,
    });
  });

  res.json(Object.values(grouped));
});

// ── Admin ─────────────────────────────────────────────────
router.get("/admin/all", auth, (req, res) => {
  const { limit = 20, offset = 0, search } = req.query;
  let query = "SELECT * FROM faqs";
  const params = [];
  if (search) {
    query += " WHERE question LIKE ? OR question_en LIKE ? OR answer LIKE ?";
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  query += " ORDER BY category, sort_order ASC LIMIT ? OFFSET ?";
  params.push(Number(limit), Number(offset));
  const faqs = db.prepare(query).all(...params);
  const total = db.prepare("SELECT COUNT(*) as count FROM faqs").get().count;
  res.json({ faqs, total });
});

router.post("/", auth, (req, res) => {
  const {
    question,
    question_en,
    answer,
    answer_en,
    category,
    sort_order,
    status,
  } = req.body;
  if (!question || !answer)
    return res.status(400).json({ error: "กรุณากรอกคำถามและคำตอบ" });
  const result = db
    .prepare(
      "INSERT INTO faqs (question,question_en,answer,answer_en,category,sort_order,status) VALUES (?,?,?,?,?,?,?)",
    )
    .run(
      question,
      question_en || "",
      answer,
      answer_en || "",
      category || "ทั่วไป",
      sort_order || 0,
      status || "published",
    );
  res
    .status(201)
    .json(
      db.prepare("SELECT * FROM faqs WHERE id = ?").get(result.lastInsertRowid),
    );
});

// ── Dynamic :id (ต้องอยู่หลัง /admin/all) ────────────────
router.post("/:id", auth, handleUpdate);
router.put("/:id", auth, handleUpdate);

function handleUpdate(req, res) {
  const {
    question,
    question_en,
    answer,
    answer_en,
    category,
    sort_order,
    status,
  } = req.body;
  const faq = db.prepare("SELECT * FROM faqs WHERE id = ?").get(req.params.id);
  if (!faq) return res.status(404).json({ error: "ไม่พบ FAQ" });
  db.prepare(
    `UPDATE faqs SET question=?,question_en=?,answer=?,answer_en=?,category=?,sort_order=?,status=?,updated_at=datetime('now','localtime') WHERE id=?`,
  ).run(
    question || faq.question,
    question_en ?? faq.question_en,
    answer || faq.answer,
    answer_en ?? faq.answer_en,
    category || faq.category,
    sort_order ?? faq.sort_order,
    status || faq.status,
    req.params.id,
  );
  res.json(db.prepare("SELECT * FROM faqs WHERE id = ?").get(req.params.id));
}

router.delete("/:id", auth, (req, res) => {
  const faq = db.prepare("SELECT * FROM faqs WHERE id = ?").get(req.params.id);
  if (!faq) return res.status(404).json({ error: "ไม่พบ FAQ" });
  db.prepare("DELETE FROM faqs WHERE id = ?").run(req.params.id);
  res.json({ message: "ลบ FAQ สำเร็จ" });
});

module.exports = router;
