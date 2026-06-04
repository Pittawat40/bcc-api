// routes/videos.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const db = require("../db");
const auth = require("../middleware/auth");

const storage = multer.diskStorage({
  destination: path.join(__dirname, "../uploads/videos"),
  filename: (req, file, cb) =>
    cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

router.get("/", (req, res) => {
  const { category, limit = 20, offset = 0 } = req.query;
  let query = "SELECT * FROM videos WHERE status = 'published'";
  const params = [];
  if (category) {
    query += " AND category = ?";
    params.push(category);
  }
  query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  params.push(Number(limit), Number(offset));
  const videos = db.prepare(query).all(...params);
  const total = db
    .prepare("SELECT COUNT(*) as count FROM videos WHERE status = 'published'")
    .get().count;
  res.json({ videos, total });
});

router.get("/admin/all", auth, (req, res) => {
  const { limit = 20, offset = 0, search } = req.query;
  let query = "SELECT * FROM videos";
  const params = [];
  if (search) {
    query += " WHERE title LIKE ? OR title_en LIKE ?";
    params.push(`%${search}%`, `%${search}%`);
  }
  query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  params.push(Number(limit), Number(offset));
  const videos = db.prepare(query).all(...params);
  const total = db.prepare("SELECT COUNT(*) as count FROM videos").get().count;
  res.json({ videos, total });
});

router.post("/", auth, upload.single("thumbnail"), (req, res) => {
  const {
    title,
    title_en,
    description,
    description_en,
    url,
    category,
    status,
  } = req.body;
  if (!title) return res.status(400).json({ error: "กรุณากรอกชื่อวิดีโอ" });
  if (!url) return res.status(400).json({ error: "กรุณากรอก URL วิดีโอ" });
  const id = uuidv4();
  const thumbnail = req.file ? `/uploads/videos/${req.file.filename}` : null;
  db.prepare(
    "INSERT INTO videos (id,title,title_en,description,description_en,url,thumbnail,category,status) VALUES (?,?,?,?,?,?,?,?,?)",
  ).run(
    id,
    title,
    title_en || "",
    description || "",
    description_en || "",
    url,
    thumbnail,
    category || "general",
    status || "published",
  );
  res.status(201).json(db.prepare("SELECT * FROM videos WHERE id = ?").get(id));
});

router.get("/:id", (req, res) => {
  const video = db
    .prepare("SELECT * FROM videos WHERE id = ?")
    .get(req.params.id);
  if (!video) return res.status(404).json({ error: "ไม่พบวิดีโอ" });
  db.prepare("UPDATE videos SET views = views + 1 WHERE id = ?").run(video.id);
  res.json(video);
});

router.post("/:id", auth, upload.single("thumbnail"), handleUpdate);
router.put("/:id", auth, upload.single("thumbnail"), handleUpdate);

function handleUpdate(req, res) {
  const {
    title,
    title_en,
    description,
    description_en,
    url,
    category,
    status,
  } = req.body;
  const video = db
    .prepare("SELECT * FROM videos WHERE id = ?")
    .get(req.params.id);
  if (!video) return res.status(404).json({ error: "ไม่พบวิดีโอ" });
  const thumbnail = req.file
    ? `/uploads/videos/${req.file.filename}`
    : video.thumbnail;
  db.prepare(
    `UPDATE videos SET title=?,title_en=?,description=?,description_en=?,url=?,thumbnail=?,category=?,status=?,updated_at=datetime('now','localtime') WHERE id=?`,
  ).run(
    title || video.title,
    title_en ?? video.title_en,
    description ?? video.description,
    description_en ?? video.description_en,
    url || video.url,
    thumbnail,
    category || video.category,
    status || video.status,
    req.params.id,
  );
  res.json(db.prepare("SELECT * FROM videos WHERE id = ?").get(req.params.id));
}

router.delete("/:id", auth, (req, res) => {
  const video = db
    .prepare("SELECT * FROM videos WHERE id = ?")
    .get(req.params.id);
  if (!video) return res.status(404).json({ error: "ไม่พบวิดีโอ" });
  db.prepare("DELETE FROM videos WHERE id = ?").run(req.params.id);
  res.json({ message: "ลบวิดีโอสำเร็จ" });
});

module.exports = router;
