// routes/stories.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs").promises;
const sharp = require("sharp");
const { v4: uuidv4 } = require("uuid");
const db = require("../db");
const auth = require("../middleware/auth");

const storage = multer.diskStorage({
  destination: path.join(__dirname, "../uploads/stories"),
  filename: (req, file, cb) =>
    cb(null, `raw-${uuidv4()}${path.extname(file.originalname)}`),
});

const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

const uploadImage = (req, res, next) => {
  upload.single("image")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res
          .status(400)
          .json({ error: "ขนาดไฟล์ใหญ่เกินไป (จำกัดไม่เกิน 5MB)" });
      }
      return res.status(400).json({ error: err.message });
    } else if (err) {
      return res.status(500).json({ error: "เกิดข้อผิดพลาดในการอัปโหลดไฟล์" });
    }
    next();
  });
};

router.get("/", (req, res) => {
  const { limit = 10, offset = 0 } = req.query;
  const rows = db
    .prepare(
      "SELECT * FROM stories WHERE status = 'published' ORDER BY sort_order ASC, created_at DESC LIMIT ? OFFSET ?",
    )
    .all(Number(limit), Number(offset));
  const total = db
    .prepare("SELECT COUNT(*) as count FROM stories WHERE status = 'published'")
    .get().count;
  res.json({ stories: rows, total });
});

router.get("/admin/all", auth, (req, res) => {
  const rows = db
    .prepare("SELECT * FROM stories ORDER BY sort_order ASC, created_at DESC")
    .all();
  res.json(rows);
});

router.post("/", auth, uploadImage, async (req, res) => {
  const {
    title,
    title_en,
    author,
    author_en,
    date,
    treatment,
    cycle,
    story,
    story_en,
    status,
    sort_order,
  } = req.body;

  if (!title || !story)
    return res.status(400).json({ error: "กรุณากรอกชื่อเรื่องและเนื้อหา" });

  const id = uuidv4();
  let image = null;

  if (req.file) {
    const rawPath = req.file.path;
    const processedFilename = `${uuidv4()}.jpg`;
    const processedPath = path.join(
      __dirname,
      "../uploads/stories",
      processedFilename,
    );

    try {
      await sharp(rawPath)
        .resize(800, 600, { fit: "cover" })
        .jpeg({ quality: 80 })
        .toFile(processedPath);

      await fs.unlink(rawPath);
      image = `/uploads/stories/${processedFilename}`;
    } catch (err) {
      return res
        .status(500)
        .json({ error: "เกิดข้อผิดพลาดในการประมวลผลรูปภาพ" });
    }
  }

  db.prepare(
    `INSERT INTO stories
     (id,title,title_en,author,author_en,date,treatment,cycle,story,story_en,image,status,sort_order)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    id,
    title,
    title_en || "",
    author || "",
    author_en || "",
    date || "",
    treatment || "",
    cycle || "",
    story,
    story_en || "",
    image,
    status || "published",
    sort_order || 0,
  );

  res
    .status(201)
    .json(db.prepare("SELECT * FROM stories WHERE id = ?").get(id));
});

router.post("/:id", auth, uploadImage, handleUpdate);
router.put("/:id", auth, uploadImage, handleUpdate);

async function handleUpdate(req, res) {
  const {
    title,
    title_en,
    author,
    author_en,
    date,
    treatment,
    cycle,
    story,
    story_en,
    status,
    sort_order,
  } = req.body;

  const row = db
    .prepare("SELECT * FROM stories WHERE id = ?")
    .get(req.params.id);
  if (!row) return res.status(404).json({ error: "ไม่พบเรื่องราว" });

  let image = row.image;

  if (req.file) {
    const rawPath = req.file.path;
    const processedFilename = `${uuidv4()}.jpg`;
    const processedPath = path.join(
      __dirname,
      "../uploads/stories",
      processedFilename,
    );

    try {
      await sharp(rawPath)
        .resize(800, 600, { fit: "cover" })
        .jpeg({ quality: 80 })
        .toFile(processedPath);

      await fs.unlink(rawPath);
      image = `/uploads/stories/${processedFilename}`;
    } catch (err) {
      return res
        .status(500)
        .json({ error: "เกิดข้อผิดพลาดในการประมวลผลรูปภาพ" });
    }
  }

  db.prepare(
    `UPDATE stories
     SET title=?,title_en=?,author=?,author_en=?,date=?,treatment=?,cycle=?,
         story=?,story_en=?,image=?,status=?,sort_order=?,
         updated_at=datetime('now','localtime')
     WHERE id=?`,
  ).run(
    title || row.title,
    title_en ?? row.title_en,
    author ?? row.author,
    author_en ?? row.author_en,
    date ?? row.date,
    treatment ?? row.treatment,
    cycle ?? row.cycle,
    story || row.story,
    story_en ?? row.story_en,
    image,
    status || row.status,
    sort_order ?? row.sort_order,
    req.params.id,
  );

  res.json(db.prepare("SELECT * FROM stories WHERE id = ?").get(req.params.id));
}

router.delete("/:id", auth, (req, res) => {
  const row = db
    .prepare("SELECT * FROM stories WHERE id = ?")
    .get(req.params.id);
  if (!row) return res.status(404).json({ error: "ไม่พบเรื่องราว" });
  db.prepare("DELETE FROM stories WHERE id = ?").run(req.params.id);
  res.json({ message: "ลบสำเร็จ" });
});

module.exports = router;
