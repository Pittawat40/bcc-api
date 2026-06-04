// routes/gallery.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const db = require("../db");
const auth = require("../middleware/auth");

const storage = multer.diskStorage({
  destination: path.join(__dirname, "../uploads/gallery"),
  filename: (req, file, cb) =>
    cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// ── Public ────────────────────────────────────────────────

// GET /api/gallery
router.get("/", (req, res) => {
  const rows = db
    .prepare(
      "SELECT * FROM gallery WHERE status = 'published' ORDER BY sort_order ASC",
    )
    .all();
  res.json(rows);
});

// ── Admin (ก่อน /:id) ─────────────────────────────────────

// GET /api/gallery/admin/all
router.get("/admin/all", auth, (req, res) => {
  const rows = db
    .prepare("SELECT * FROM gallery ORDER BY sort_order ASC")
    .all();
  res.json(rows);
});

// POST /api/gallery  — สร้างใหม่
router.post("/", auth, upload.single("media"), (req, res) => {
  const {
    caption_th,
    caption_en,
    media_url,
    media_type,
    col_span,
    row_span,
    sort_order,
    status,
  } = req.body;
  const id = uuidv4();
  const finalUrl = req.file
    ? `/uploads/gallery/${req.file.filename}`
    : media_url || "";
  if (!finalUrl)
    return res.status(400).json({ error: "กรุณาอัปโหลดไฟล์หรือระบุ URL" });

  db.prepare(
    `INSERT INTO gallery (id,caption_th,caption_en,media_url,media_type,col_span,row_span,sort_order,status)
    VALUES (?,?,?,?,?,?,?,?,?)`,
  ).run(
    id,
    caption_th || "",
    caption_en || "",
    finalUrl,
    media_type || "image",
    col_span || "md:col-span-4",
    row_span || "md:row-span-1",
    Number(sort_order) || 0,
    status || "published",
  );

  res
    .status(201)
    .json(db.prepare("SELECT * FROM gallery WHERE id = ?").get(id));
});

// ── Dynamic :id ───────────────────────────────────────────

// POST /api/gallery/:id  — update
router.post("/:id", auth, upload.single("media"), handleUpdate);
// PUT /api/gallery/:id   — update (REST)
router.put("/:id", auth, upload.single("media"), handleUpdate);

function handleUpdate(req, res) {
  const row = db
    .prepare("SELECT * FROM gallery WHERE id = ?")
    .get(req.params.id);
  if (!row) return res.status(404).json({ error: "ไม่พบรายการ gallery" });

  const {
    caption_th,
    caption_en,
    media_url,
    media_type,
    col_span,
    row_span,
    sort_order,
    status,
  } = req.body;
  const finalUrl = req.file
    ? `/uploads/gallery/${req.file.filename}`
    : media_url || row.media_url;

  db.prepare(
    `UPDATE gallery SET caption_th=?,caption_en=?,media_url=?,media_type=?,col_span=?,row_span=?,sort_order=?,status=?,updated_at=datetime('now','localtime') WHERE id=?`,
  ).run(
    caption_th ?? row.caption_th,
    caption_en ?? row.caption_en,
    finalUrl,
    media_type || row.media_type,
    col_span || row.col_span,
    row_span || row.row_span,
    sort_order !== undefined ? Number(sort_order) : row.sort_order,
    status || row.status,
    req.params.id,
  );

  res.json(db.prepare("SELECT * FROM gallery WHERE id = ?").get(req.params.id));
}

// DELETE /api/gallery/:id
router.delete("/:id", auth, (req, res) => {
  const row = db
    .prepare("SELECT * FROM gallery WHERE id = ?")
    .get(req.params.id);
  if (!row) return res.status(404).json({ error: "ไม่พบรายการ gallery" });
  db.prepare("DELETE FROM gallery WHERE id = ?").run(req.params.id);
  res.json({ message: "ลบรายการสำเร็จ" });
});

module.exports = router;
