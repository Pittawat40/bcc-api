const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../middleware/auth");

const { notifyNewAppointment } = require("../utils/lineMessaging");

router.get("/check-new", auth, (req, res) => {
  const { since } = req.query;

  const sinceTime = since
    ? String(since).replace("T", " ").slice(0, 19)
    : db.prepare("SELECT datetime('now', 'localtime', '-5 minutes')").get()[
        "datetime('now', 'localtime', '-5 minutes')"
      ];

  const newAppts = db
    .prepare(
      "SELECT COUNT(*) as count FROM appointments WHERE datetime(created_at) >= datetime(?)",
    )
    .get(sinceTime);

  const latest = db
    .prepare(
      "SELECT * FROM appointments WHERE datetime(created_at) >= datetime(?) ORDER BY created_at DESC LIMIT 5",
    )
    .all(sinceTime);

  const currentServerTime = db
    .prepare("SELECT datetime('now', 'localtime')")
    .get()["datetime('now', 'localtime')"];

  res.json({
    hasNew: newAppts.count > 0,
    count: newAppts.count,
    latest,
    serverTime: currentServerTime,
  });
});

router.post("/", async (req, res) => {
  const { name, phone, email, service, message } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ error: "กรุณากรอกชื่อและเบอร์โทรศัพท์" });
  }

  const result = db
    .prepare(
      `
    INSERT INTO appointments (name, phone, email, service, message, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
  `,
    )
    .run(name, phone, email || "", service || "", message || "");

  await notifyNewAppointment({ name, phone, email, service, message });

  res.status(201).json({
    id: result.lastInsertRowid,
    message: "ส่งข้อมูลนัดหมายสำเร็จ",
  });
});

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

  const mainQuery =
    "SELECT * FROM appointments" +
    whereClause +
    " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  const mainParams = [...baseParams, Number(limit), Number(offset)];
  const rows = db.prepare(mainQuery).all(...mainParams);

  const totalQuery = "SELECT COUNT(*) as count FROM appointments" + whereClause;
  const total = db.prepare(totalQuery).get(...baseParams).count;

  res.json({ appointments: rows, total });
});

router.put("/:id", auth, (req, res) => {
  let { status, note, appointment_date } = req.body;

  const row = db
    .prepare("SELECT * FROM appointments WHERE id = ?")
    .get(req.params.id);
  if (!row) return res.status(404).json({ error: "ไม่พบรายการนัดหมาย" });

  db.prepare(
    `
    UPDATE appointments
    SET status = ?, note = ?, appointment_date = ?, updated_at = datetime('now','localtime')
    WHERE id = ?
  `,
  ).run(
    status || row.status,
    note ?? row.note,
    appointment_date ?? row.appointment_date,
    req.params.id,
  );

  res.json(
    db.prepare("SELECT * FROM appointments WHERE id = ?").get(req.params.id),
  );
});

router.delete("/:id", auth, (req, res) => {
  const row = db
    .prepare("SELECT * FROM appointments WHERE id = ?")
    .get(req.params.id);
  if (!row) return res.status(404).json({ error: "ไม่พบรายการนัดหมาย" });
  db.prepare("DELETE FROM appointments WHERE id = ?").run(req.params.id);
  res.json({ message: "ลบรายการสำเร็จ" });
});

module.exports = router;
