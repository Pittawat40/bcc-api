// routes/appointments.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../middleware/auth");

// ── Public ────────────────────────────────────────────────

router.get("/check-new", auth, (req, res) => {
  const { since } = req.query;

  const sinceTime = since
    ? String(since).replace("T", " ").slice(0, 19)
    : new Date(Date.now() - 5 * 60 * 1000)
        .toISOString()
        .replace("T", " ")
        .slice(0, 19);

  const newAppts = db
    .prepare("SELECT COUNT(*) as count FROM appointments WHERE created_at > ?")
    .get(sinceTime);

  const latest = db
    .prepare(
      "SELECT * FROM appointments WHERE created_at > ? ORDER BY created_at DESC LIMIT 5",
    )
    .all(sinceTime);

  res.json({
    hasNew: newAppts.count > 0,
    count: newAppts.count,
    latest,
  });
});

// POST /api/appointments  — ลูกค้าส่งฟอร์มนัดหมาย
router.post("/", (req, res) => {
  const { name, phone, email, service, message } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ error: "กรุณากรอกชื่อและเบอร์โทรศัพท์" });
  }
  const result = db
    .prepare(
      `
    INSERT INTO appointments (name, phone, email, service, message)
    VALUES (?, ?, ?, ?, ?)
  `,
    )
    .run(name, phone, email || "", service || "", message || "");

  res.status(201).json({
    id: result.lastInsertRowid,
    message: "ส่งข้อมูลนัดหมายสำเร็จ",
  });
});

// ── Admin ────────────────────────────────────────────────

// GET /api/appointments/admin/all
router.get("/admin/all", auth, (req, res) => {
  const { status, limit = 50, offset = 0, search } = req.query;
  const conditions = [];
  const baseParams = [];

  if (status) {
    conditions.push("status = ?");
    baseParams.push(status);
  }
  if (search) {
    conditions.push("(name LIKE ? OR phone LIKE ? OR email LIKE ?)");
    baseParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const whereClause = conditions.length
    ? " WHERE " + conditions.join(" AND ")
    : "";

  let mainQuery =
    "SELECT * FROM appointments" +
    whereClause +
    " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  const mainParams = [...baseParams, Number(limit), Number(offset)];
  const rows = db.prepare(mainQuery).all(...mainParams);

  let totalQuery = "SELECT COUNT(*) as count FROM appointments" + whereClause;
  const total = db.prepare(totalQuery).get(...baseParams).count;

  res.json({ appointments: rows, total });
});

// PUT /api/appointments/:id  — เปลี่ยนสถานะ (pending/contacted/done/cancelled)
router.put("/:id", auth, (req, res) => {
  const { status, note } = req.body;
  const row = db
    .prepare("SELECT * FROM appointments WHERE id = ?")
    .get(req.params.id);
  if (!row) return res.status(404).json({ error: "ไม่พบรายการนัดหมาย" });

  db.prepare(
    `
    UPDATE appointments
    SET status = ?, note = ?, updated_at = datetime('now','localtime')
    WHERE id = ?
  `,
  ).run(status || row.status, note ?? row.note, req.params.id);

  res.json(
    db.prepare("SELECT * FROM appointments WHERE id = ?").get(req.params.id),
  );
});

// DELETE /api/appointments/:id
router.delete("/:id", auth, (req, res) => {
  const row = db
    .prepare("SELECT * FROM appointments WHERE id = ?")
    .get(req.params.id);
  if (!row) return res.status(404).json({ error: "ไม่พบรายการนัดหมาย" });
  db.prepare("DELETE FROM appointments WHERE id = ?").run(req.params.id);
  res.json({ message: "ลบรายการสำเร็จ" });
});

module.exports = router;
