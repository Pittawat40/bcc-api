// routes/doctors.js
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
  destination: path.join(__dirname, "../uploads/doctors"),
  filename: (req, file, cb) =>
    cb(null, `raw-${uuidv4()}${path.extname(file.originalname)}`),
});

const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 } });

// 🟢 1. เพิ่ม Middleware ตัวนี้เข้าไปเพื่อดักจับ Error จาก Multer โดยเฉพาะ
const uploadPhoto = (req, res, next) => {
  upload.single("photo")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      // ดักจับ Error ที่มาจากตัว Multer เอง
      if (err.code === "LIMIT_FILE_SIZE") {
        return res
          .status(400)
          .json({ error: "ขนาดไฟล์ใหญ่เกินไป (จำกัดไม่เกิน 2MB)" });
      }
      return res.status(400).json({ error: err.message });
    } else if (err) {
      // ดักจับ Error อื่นๆ ที่ไม่คาดคิด
      return res.status(500).json({ error: "เกิดข้อผิดพลาดในการอัปโหลดไฟล์" });
    }
    next();
  });
};

router.get("/", (req, res) => {
  const doctors = db
    .prepare(
      "SELECT * FROM doctors WHERE status = 'published' ORDER BY sort_order ASC",
    )
    .all();
  res.json(doctors.map(parseJsonFields));
});

// ── Admin (before /:id) ───────────────────────────────────

router.get("/admin/all", auth, (req, res) => {
  const { limit = 20, offset = 0, search } = req.query;
  let query = "SELECT * FROM doctors";
  const params = [];
  if (search) {
    query += " WHERE name LIKE ? OR name_en LIKE ? OR title LIKE ?";
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  query += " ORDER BY sort_order ASC LIMIT ? OFFSET ?";
  params.push(Number(limit), Number(offset));
  const doctors = db.prepare(query).all(...params);
  const total = db.prepare("SELECT COUNT(*) as count FROM doctors").get().count;
  res.json({ doctors: doctors.map(parseJsonFields), total });
});

// 🟢 2. เปลี่ยนจาก `upload.single("photo")` มาเรียกใช้ `uploadPhoto` ที่เราสร้างไว้แทน
router.post("/", auth, uploadPhoto, async (req, res) => {
  const {
    name,
    name_en,
    title,
    title_en,
    bio,
    bio_en,
    education,
    education_en,
    specialties,
    avatar_grad,
    sort_order,
    status,
  } = req.body;
  if (!name) return res.status(400).json({ error: "กรุณากรอกชื่อแพทย์" });

  const id = uuidv4();
  let photo = null;

  if (req.file) {
    const rawPath = req.file.path;
    const processedFilename = `${uuidv4()}.jpg`;
    const processedPath = path.join(
      __dirname,
      "../uploads/doctors",
      processedFilename,
    );

    try {
      await sharp(rawPath)
        .resize(400, 400, { fit: "cover" })
        .jpeg({ quality: 80 })
        .toFile(processedPath);

      await fs.unlink(rawPath);
      photo = `/uploads/doctors/${processedFilename}`;
    } catch (err) {
      return res
        .status(500)
        .json({ error: "เกิดข้อผิดพลาดในการประมวลผลรูปภาพ" });
    }
  }

  const eduJson = education
    ? typeof education === "string"
      ? education
      : JSON.stringify(education)
    : "[]";
  const eduEnJson = education_en
    ? typeof education_en === "string"
      ? education_en
      : JSON.stringify(education_en)
    : "[]";
  const specJson = specialties
    ? typeof specialties === "string"
      ? specialties
      : JSON.stringify(specialties)
    : "[]";

  db.prepare(
    "INSERT INTO doctors (id,name,name_en,title,title_en,bio,bio_en,photo,education,education_en,specialties,avatar_grad,sort_order,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
  ).run(
    id,
    name,
    name_en || "",
    title || "",
    title_en || "",
    bio || "",
    bio_en || "",
    photo,
    eduJson,
    eduEnJson,
    specJson,
    avatar_grad || "from-brand-400 to-brand-600",
    sort_order || 0,
    status || "published",
  );
  res
    .status(201)
    .json(
      parseJsonFields(db.prepare("SELECT * FROM doctors WHERE id = ?").get(id)),
    );
});

// ── Dynamic :id ───────────────────────────────────────────

router.get("/:id", (req, res) => {
  const doctor = db
    .prepare("SELECT * FROM doctors WHERE id = ?")
    .get(req.params.id);
  if (!doctor) return res.status(404).json({ error: "ไม่พบข้อมูลแพทย์" });
  res.json(parseJsonFields(doctor));
});

// 🟢 3. อัปเดตตรงนี้ให้ใช้ `uploadPhoto` ด้วยเช่นกันครับ
router.post("/:id", auth, uploadPhoto, handleUpdate);
router.put("/:id", auth, uploadPhoto, handleUpdate);

async function handleUpdate(req, res) {
  const {
    name,
    name_en,
    title,
    title_en,
    bio,
    bio_en,
    education,
    education_en,
    specialties,
    avatar_grad,
    sort_order,
    status,
    photo: photoFromBody,
  } = req.body;

  const doctor = db
    .prepare("SELECT * FROM doctors WHERE id = ?")
    .get(req.params.id);

  if (!doctor) return res.status(404).json({ error: "ไม่พบข้อมูลแพทย์" });

  let photo = doctor.photo;

  if (req.file) {
    const rawPath = req.file.path;
    const processedFilename = `${uuidv4()}.jpg`;
    const processedPath = path.join(
      __dirname,
      "../uploads/doctors",
      processedFilename,
    );

    try {
      await sharp(rawPath)
        .resize(400, 400, { fit: "cover" })
        .jpeg({ quality: 80 })
        .toFile(processedPath);

      await fs.unlink(rawPath);
      photo = `/uploads/doctors/${processedFilename}`;
    } catch (err) {
      return res
        .status(500)
        .json({ error: "เกิดข้อผิดพลาดในการประมวลผลรูปภาพ" });
    }
  } else if (photoFromBody === "" || photoFromBody === "null") {
    photo = null;
  }

  const eduJson = education
    ? typeof education === "string"
      ? education
      : JSON.stringify(education)
    : doctor.education;
  const eduEnJson = education_en
    ? typeof education_en === "string"
      ? education_en
      : JSON.stringify(education_en)
    : doctor.education_en;
  const specJson = specialties
    ? typeof specialties === "string"
      ? specialties
      : JSON.stringify(specialties)
    : doctor.specialties;

  db.prepare(
    `UPDATE doctors SET name=?,name_en=?,title=?,title_en=?,bio=?,bio_en=?,photo=?,education=?,education_en=?,specialties=?,avatar_grad=?,sort_order=?,status=?,updated_at=datetime('now','localtime') WHERE id=?`,
  ).run(
    name || doctor.name,
    name_en ?? doctor.name_en,
    title ?? doctor.title,
    title_en ?? doctor.title_en,
    bio ?? doctor.bio,
    bio_en ?? doctor.bio_en,
    photo,
    eduJson,
    eduEnJson,
    specJson,
    avatar_grad || doctor.avatar_grad,
    sort_order ?? doctor.sort_order,
    status || doctor.status,
    req.params.id,
  );

  res.json(
    parseJsonFields(
      db.prepare("SELECT * FROM doctors WHERE id = ?").get(req.params.id),
    ),
  );
}

router.delete("/:id", auth, (req, res) => {
  const doctor = db
    .prepare("SELECT * FROM doctors WHERE id = ?")
    .get(req.params.id);
  if (!doctor) return res.status(404).json({ error: "ไม่พบข้อมูลแพทย์" });
  db.prepare("DELETE FROM doctors WHERE id = ?").run(req.params.id);
  res.json({ message: "ลบข้อมูลแพทย์สำเร็จ" });
});

function parseJsonFields(d) {
  try {
    d.education = JSON.parse(d.education);
  } catch {
    d.education = [];
  }
  try {
    d.education_en = JSON.parse(d.education_en);
  } catch {
    d.education_en = [];
  }
  try {
    d.specialties = JSON.parse(d.specialties);
  } catch {
    d.specialties = [];
  }
  return d;
}

module.exports = router;
