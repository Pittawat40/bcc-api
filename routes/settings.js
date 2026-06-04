// routes/settings.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../middleware/auth");

// ── Runtime migrations ──────────────────────────────────────────────────────
function addColumnIfMissing(table, column, type) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.find((c) => c.name === column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`).run();
  }
}
// ที่อยู่ภาษาอังกฤษ
addColumnIfMissing("contact_info", "value_en", "TEXT DEFAULT ''");
// เวลาทำการ 2 ภาษา
addColumnIfMissing("business_hours", "day_label_en", "TEXT DEFAULT ''");
addColumnIfMissing("business_hours", "hours_en", "TEXT DEFAULT ''");

// ── Public: Contact Info ────────────────────────────────────────────────────

// GET /api/settings/contact
router.get("/contact", (req, res) => {
  const info = db
    .prepare("SELECT * FROM contact_info ORDER BY sort_order ASC")
    .all();
  const hours = db
    .prepare("SELECT * FROM business_hours ORDER BY sort_order ASC")
    .all();
  res.json({ contactInfo: info, businessHours: hours });
});

// ── Public: Social Media ────────────────────────────────────────────────────

// GET /api/settings/social
router.get("/social", (req, res) => {
  const socials = db
    .prepare(
      "SELECT * FROM social_media WHERE is_active = 1 ORDER BY sort_order ASC",
    )
    .all();
  res.json(socials);
});

// ── Admin: Contact Info ─────────────────────────────────────────────────────

// PUT /api/settings/contact
router.put("/contact", auth, (req, res) => {
  const { contactInfo, businessHours } = req.body;

  if (contactInfo) {
    const stmt = db.prepare(`
      INSERT INTO contact_info (key, label, value, value_en, href, icon, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        label      = excluded.label,
        value      = excluded.value,
        value_en   = excluded.value_en,
        href       = excluded.href,
        icon       = excluded.icon,
        sort_order = excluded.sort_order
    `);
    const updateAll = db.transaction(() => {
      contactInfo.forEach((c) =>
        stmt.run(
          c.key,
          c.label,
          c.value,
          c.value_en || "",
          c.href || null,
          c.icon || null,
          c.sort_order || 0,
        ),
      );
    });
    updateAll();
  }

  if (businessHours) {
    db.prepare("DELETE FROM business_hours").run();
    const stmt = db.prepare(
      "INSERT INTO business_hours (day_label, day_label_en, hours, hours_en, is_closed, sort_order) VALUES (?,?,?,?,?,?)",
    );
    const insertAll = db.transaction(() => {
      businessHours.forEach((h, i) =>
        stmt.run(
          h.day_label,
          h.day_label_en || "",
          h.hours,
          h.hours_en || "",
          h.is_closed ? 1 : 0,
          i + 1,
        ),
      );
    });
    insertAll();
  }

  res.json({ message: "บันทึกข้อมูลติดต่อสำเร็จ" });
});

// PUT /api/settings/contact/:key  — single field upsert
router.put("/contact/:key", auth, (req, res) => {
  const { label, value, value_en, href, icon, sort_order } = req.body;
  db.prepare(
    `
    INSERT INTO contact_info (key, label, value, value_en, href, icon, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      label      = excluded.label,
      value      = excluded.value,
      value_en   = excluded.value_en,
      href       = excluded.href,
      icon       = excluded.icon,
      sort_order = excluded.sort_order
  `,
  ).run(
    req.params.key,
    label,
    value,
    value_en || "",
    href || null,
    icon || null,
    sort_order || 0,
  );
  res.json({ message: "บันทึกสำเร็จ" });
});

// ── Admin: Social Media ─────────────────────────────────────────────────────

// GET /api/settings/social/admin
router.get("/social/admin", auth, (req, res) => {
  const socials = db
    .prepare("SELECT * FROM social_media ORDER BY sort_order ASC")
    .all();
  res.json(socials);
});

// PUT /api/settings/social  — upsert all (batch save)
router.put("/social", auth, (req, res) => {
  const { socials } = req.body;
  if (!Array.isArray(socials))
    return res.status(400).json({ error: "ข้อมูลไม่ถูกต้อง" });

  const stmt = db.prepare(`
    INSERT INTO social_media (platform, url, label, icon, is_active, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(platform) DO UPDATE SET
      url        = excluded.url,
      label      = excluded.label,
      icon       = excluded.icon,
      is_active  = excluded.is_active,
      sort_order = excluded.sort_order
  `);
  const upsertAll = db.transaction(() => {
    socials.forEach((s, i) =>
      stmt.run(
        s.platform,
        s.url,
        s.label || s.platform,
        s.icon || s.platform,
        s.is_active !== undefined ? (s.is_active ? 1 : 0) : 1,
        s.sort_order ?? i + 1,
      ),
    );
  });
  upsertAll();
  res.json({ message: "บันทึกข้อมูล Social Media สำเร็จ" });
});

// PATCH /api/settings/social/:platform/status  — toggle is_active only
router.patch("/social/:platform/status", auth, (req, res) => {
  const { is_active } = req.body;
  const row = db
    .prepare("SELECT * FROM social_media WHERE platform = ?")
    .get(req.params.platform);
  if (!row) return res.status(404).json({ error: "ไม่พบ platform" });
  db.prepare("UPDATE social_media SET is_active = ? WHERE platform = ?").run(
    is_active ? 1 : 0,
    req.params.platform,
  );
  res.json({ message: "อัปเดต status สำเร็จ", is_active: !!is_active });
});

// PATCH /api/settings/social/reorder  — update sort_order for all items
router.patch("/social/reorder", auth, (req, res) => {
  const { order } = req.body; // [{ platform, sort_order }, ...]
  if (!Array.isArray(order))
    return res.status(400).json({ error: "ข้อมูลไม่ถูกต้อง" });
  const stmt = db.prepare(
    "UPDATE social_media SET sort_order = ? WHERE platform = ?",
  );
  const updateAll = db.transaction(() => {
    order.forEach((item) => stmt.run(item.sort_order, item.platform));
  });
  updateAll();
  res.json({ message: "อัปเดตลำดับสำเร็จ" });
});

// PUT /api/settings/social/:platform  — full update single platform
router.put("/social/:platform", auth, (req, res) => {
  const { url, label, icon, is_active, sort_order } = req.body;
  db.prepare(
    `
    INSERT INTO social_media (platform, url, label, icon, is_active, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(platform) DO UPDATE SET
      url        = excluded.url,
      label      = excluded.label,
      icon       = excluded.icon,
      is_active  = excluded.is_active,
      sort_order = excluded.sort_order
  `,
  ).run(
    req.params.platform,
    url,
    label || req.params.platform,
    icon || req.params.platform,
    is_active !== undefined ? (is_active ? 1 : 0) : 1,
    sort_order || 0,
  );
  res.json({ message: "บันทึกสำเร็จ" });
});

module.exports = router;
