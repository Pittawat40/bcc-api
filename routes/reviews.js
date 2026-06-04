// routes/reviews.js
const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const db = require("../db");
const auth = require("../middleware/auth");

const withCategory = (query) => `
  SELECT r.*,
         COALESCE(rc.name_th, r.category) AS category_th,
         COALESCE(rc.name_en, r.category) AS category_en
  FROM (${query}) r
  LEFT JOIN review_categories rc ON rc.name_th = r.category
`;

// ── Public ────────────────────────────────────────────────

router.get("/", (req, res) => {
  const { category, featured, limit = 20, offset = 0 } = req.query;

  let inner = "SELECT * FROM reviews WHERE status = 'published'";
  const params = [];
  if (category) {
    inner += " AND category = ?";
    params.push(category);
  }
  if (featured === "1") {
    inner += " AND is_featured = 1";
  }
  inner += " ORDER BY is_featured DESC, created_at DESC LIMIT ? OFFSET ?";
  params.push(Number(limit), Number(offset));

  const reviews = db.prepare(withCategory(inner)).all(...params);
  const total = db
    .prepare("SELECT COUNT(*) as count FROM reviews WHERE status = 'published'")
    .get().count;
  res.json({ reviews, total });
});

// ── Admin ─────────────────────────────────────────────────

router.get("/admin/all", auth, (req, res) => {
  const { limit = 20, offset = 0, search } = req.query;
  let inner = "SELECT * FROM reviews";
  const params = [];
  if (search) {
    inner += " WHERE author_name LIKE ? OR content LIKE ?";
    params.push(`%${search}%`, `%${search}%`);
  }
  inner += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  params.push(Number(limit), Number(offset));

  const reviews = db.prepare(withCategory(inner)).all(...params);
  const total = db.prepare("SELECT COUNT(*) as count FROM reviews").get().count;
  res.json({ reviews, total });
});

router.post("/", auth, (req, res) => {
  const {
    author_name,
    author_name_en,
    date,
    content,
    content_en,
    rating,
    avatar_bg,
    category,
    is_featured,
    status,
  } = req.body;
  if (!author_name || !content)
    return res.status(400).json({ error: "กรุณากรอกชื่อและเนื้อหา" });

  const id = uuidv4();
  db.prepare(
    "INSERT INTO reviews (id,author_name,author_name_en,date,content,content_en,rating,avatar_bg,category,is_featured,status) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
  ).run(
    id,
    author_name,
    author_name_en || "",
    date || "",
    content,
    content_en || "",
    rating || 5,
    avatar_bg || "bg-brand-400",
    category || "IVF",
    is_featured ? 1 : 0,
    status || "published",
  );

  const review = db
    .prepare(withCategory("SELECT * FROM reviews WHERE id = ?"))
    .get(id);
  res.status(201).json(review);
});

// ── Dynamic :id ───────────────────────────────────────────

router.post("/:id", auth, handleUpdate);
router.put("/:id", auth, handleUpdate);

function handleUpdate(req, res) {
  const {
    author_name,
    author_name_en,
    date,
    content,
    content_en,
    rating,
    avatar_bg,
    category,
    is_featured,
    status,
  } = req.body;
  const review = db
    .prepare("SELECT * FROM reviews WHERE id = ?")
    .get(req.params.id);
  if (!review) return res.status(404).json({ error: "ไม่พบรีวิว" });

  db.prepare(
    `UPDATE reviews SET author_name=?,author_name_en=?,date=?,content=?,content_en=?,rating=?,avatar_bg=?,category=?,is_featured=?,status=?,updated_at=datetime('now','localtime') WHERE id=?`,
  ).run(
    author_name || review.author_name,
    author_name_en ?? review.author_name_en,
    date ?? review.date,
    content || review.content,
    content_en ?? review.content_en,
    rating ?? review.rating,
    avatar_bg || review.avatar_bg,
    category || review.category,
    is_featured !== undefined ? (is_featured ? 1 : 0) : review.is_featured,
    status || review.status,
    req.params.id,
  );

  const updated = db
    .prepare(withCategory("SELECT * FROM reviews WHERE id = ?"))
    .get(req.params.id);
  res.json(updated);
}

router.delete("/:id", auth, (req, res) => {
  const review = db
    .prepare("SELECT * FROM reviews WHERE id = ?")
    .get(req.params.id);
  if (!review) return res.status(404).json({ error: "ไม่พบรีวิว" });
  db.prepare("DELETE FROM reviews WHERE id = ?").run(req.params.id);
  res.json({ message: "ลบรีวิวสำเร็จ" });
});

module.exports = router;
