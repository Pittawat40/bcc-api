// routes/articles.js
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
  destination: path.join(__dirname, "../uploads/articles"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `raw-${uuidv4()}${ext}`);
  },
});

const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

const uploadCover = (req, res, next) => {
  upload.single("cover_image")(req, res, (err) => {
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

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\u0E00-\u0E7Fa-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

// ── Public ────────────────────────────────────────────────

router.get("/", (req, res) => {
  const { status, category, limit = 20, offset = 0 } = req.query;

  let query = `
    SELECT a.*,
           COALESCE(ac.name_th, a.category) AS category_th,
           COALESCE(ac.name_en, a.category) AS category_en
    FROM articles a
    LEFT JOIN article_categories ac ON ac.slug = a.category
    WHERE 1=1
  `;
  const params = [];
  if (status) {
    query += " AND a.status = ?";
    params.push(status);
  }
  if (category) {
    query += " AND a.category = ?";
    params.push(category);
  }
  query += " ORDER BY a.created_at DESC LIMIT ? OFFSET ?";
  params.push(Number(limit), Number(offset));

  const articles = db.prepare(query).all(...params);

  let countQuery = "SELECT COUNT(*) as count FROM articles WHERE 1=1";
  const countParams = [];
  if (status) {
    countQuery += " AND status = ?";
    countParams.push(status);
  }
  if (category) {
    countQuery += " AND category = ?";
    countParams.push(category);
  }
  const total = db.prepare(countQuery).get(...countParams).count;

  res.json({ articles: articles.map(parseJsonFields), total });
});

// ── Admin (before /:id) ───────────────────────────────────

router.get("/admin/all", auth, (req, res) => {
  const { limit = 20, offset = 0, search } = req.query;
  let query = `
    SELECT a.*,
           COALESCE(ac.name_th, a.category) AS category_th,
           COALESCE(ac.name_en, a.category) AS category_en
    FROM articles a
    LEFT JOIN article_categories ac ON ac.slug = a.category
  `;
  const params = [];
  if (search) {
    query += " WHERE a.title LIKE ? OR a.title_en LIKE ?";
    params.push(`%${search}%`, `%${search}%`);
  }
  query += " ORDER BY a.created_at DESC LIMIT ? OFFSET ?";
  params.push(Number(limit), Number(offset));
  const articles = db.prepare(query).all(...params);
  const total = db
    .prepare("SELECT COUNT(*) as count FROM articles")
    .get().count;
  res.json({ articles: articles.map(parseJsonFields), total });
});

router.post("/", auth, uploadCover, async (req, res) => {
  const {
    title,
    title_en,
    excerpt,
    excerpt_en,
    content,
    content_en,
    category,
    tags,
    status,
  } = req.body;
  if (!title) return res.status(400).json({ error: "กรุณากรอกชื่อบทความ" });

  const id = uuidv4();
  const slug = slugify(title);
  let cover_image = null;

  if (req.file) {
    const rawPath = req.file.path;
    const processedFilename = `${uuidv4()}.jpg`;
    const processedPath = path.join(
      __dirname,
      "../uploads/articles",
      processedFilename,
    );

    try {
      await sharp(rawPath)
        .resize(1200, 630, { fit: "cover" })
        .jpeg({ quality: 80 })
        .toFile(processedPath);

      await fs.unlink(rawPath);
      cover_image = `/uploads/articles/${processedFilename}`;
    } catch (err) {
      return res
        .status(500)
        .json({ error: "เกิดข้อผิดพลาดในการประมวลผลรูปภาพ" });
    }
  }

  const tagsJson = tags
    ? typeof tags === "string"
      ? tags
      : JSON.stringify(tags)
    : "[]";

  db.prepare(
    `INSERT INTO articles (id,title,title_en,slug,excerpt,excerpt_en,content,content_en,cover_image,category,tags,status)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    id,
    title,
    title_en || "",
    slug,
    excerpt || "",
    excerpt_en || "",
    content || "",
    content_en || "",
    cover_image,
    category || "general",
    tagsJson,
    status || "draft",
  );

  const article = db
    .prepare(
      `
    SELECT a.*, COALESCE(ac.name_th, a.category) AS category_th,
                COALESCE(ac.name_en, a.category) AS category_en
    FROM articles a LEFT JOIN article_categories ac ON ac.slug = a.category
    WHERE a.id = ?
  `,
    )
    .get(id);

  res.status(201).json(parseJsonFields(article));
});

// ── Dynamic :id ───────────────────────────────────────────

router.get("/:id", (req, res) => {
  const article = db
    .prepare(
      `
    SELECT a.*, COALESCE(ac.name_th, a.category) AS category_th,
                COALESCE(ac.name_en, a.category) AS category_en
    FROM articles a LEFT JOIN article_categories ac ON ac.slug = a.category
    WHERE a.id = ? OR a.slug = ?
  `,
    )
    .get(req.params.id, req.params.id);

  if (!article) return res.status(404).json({ error: "ไม่พบบทความ" });
  db.prepare("UPDATE articles SET views = views + 1 WHERE id = ?").run(
    article.id,
  );
  res.json(parseJsonFields(article));
});

router.post("/:id", auth, uploadCover, handleUpdate);
router.put("/:id", auth, uploadCover, handleUpdate);

async function handleUpdate(req, res) {
  const {
    title,
    title_en,
    excerpt,
    excerpt_en,
    content,
    content_en,
    category,
    tags,
    status,
  } = req.body;
  const article = db
    .prepare("SELECT * FROM articles WHERE id = ?")
    .get(req.params.id);
  if (!article) return res.status(404).json({ error: "ไม่พบบทความ" });

  let cover_image = article.cover_image;

  if (req.file) {
    const rawPath = req.file.path;
    const processedFilename = `${uuidv4()}.jpg`;
    const processedPath = path.join(
      __dirname,
      "../uploads/articles",
      processedFilename,
    );

    try {
      await sharp(rawPath)
        .resize(1200, 630, { fit: "cover" })
        .jpeg({ quality: 80 })
        .toFile(processedPath);

      await fs.unlink(rawPath);
      cover_image = `/uploads/articles/${processedFilename}`;
    } catch (err) {
      return res
        .status(500)
        .json({ error: "เกิดข้อผิดพลาดในการประมวลผลรูปภาพ" });
    }
  }

  const tagsJson = tags
    ? typeof tags === "string"
      ? tags
      : JSON.stringify(tags)
    : article.tags;

  db.prepare(
    `UPDATE articles SET title=?,title_en=?,excerpt=?,excerpt_en=?,content=?,content_en=?,cover_image=?,category=?,tags=?,status=?,updated_at=datetime('now','localtime') WHERE id=?`,
  ).run(
    title || article.title,
    title_en ?? article.title_en,
    excerpt ?? article.excerpt,
    excerpt_en ?? article.excerpt_en,
    content ?? article.content,
    content_en ?? article.content_en,
    cover_image,
    category || article.category,
    tagsJson,
    status !== undefined ? status : article.status,
    req.params.id,
  );

  const updated = db
    .prepare(
      `
    SELECT a.*, COALESCE(ac.name_th, a.category) AS category_th,
                COALESCE(ac.name_en, a.category) AS category_en
    FROM articles a LEFT JOIN article_categories ac ON ac.slug = a.category
    WHERE a.id = ?
  `,
    )
    .get(req.params.id);

  res.json(parseJsonFields(updated));
}

router.delete("/:id", auth, (req, res) => {
  const article = db
    .prepare("SELECT * FROM articles WHERE id = ?")
    .get(req.params.id);
  if (!article) return res.status(404).json({ error: "ไม่พบบทความ" });
  db.prepare("DELETE FROM articles WHERE id = ?").run(req.params.id);
  res.json({ message: "ลบบทความสำเร็จ" });
});

function parseJsonFields(a) {
  try {
    a.tags = JSON.parse(a.tags);
  } catch {
    a.tags = [];
  }
  return a;
}

module.exports = router;
