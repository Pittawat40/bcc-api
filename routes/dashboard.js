// routes/dashboard.js
const express = require("express");
const router = express.Router();
const db = require("../db");

// POST /api/dashboard/track
router.post("/track", (req, res) => {
  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.socket.remoteAddress ||
    "";
  const { path = "/" } = req.body;
  const ua = req.headers["user-agent"] || "";
  const referrer = req.headers["referer"] || "";

  db.prepare(
    `
    INSERT INTO visitor_logs (ip, path, user_agent, referrer)
    VALUES (?, ?, ?, ?)
  `,
  ).run(ip, path, ua, referrer);

  res.json({ success: true });
});

router.get("/", (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        visitorSummary: getVisitorSummary(),
        marketingData: getMarketingData(),
        visitorMonthlyData: getVisitorMonthly(),
        recentAppointments: getRecentAppointments(),
        contentSummary: getContentSummary(),
      },
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/visitor-summary", (req, res) => {
  try {
    res.json({ success: true, data: getVisitorSummary() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/visitor-monthly", (req, res) => {
  try {
    const labels = [
      "ม.ค.",
      "ก.พ.",
      "มี.ค.",
      "เม.ย.",
      "พ.ค.",
      "มิ.ย.",
      "ก.ค.",
      "ส.ค.",
      "ก.ย.",
      "ต.ค.",
      "พ.ย.",
      "ธ.ค.",
    ];
    res.json({
      success: true,
      data: { labels, values: getVisitorMonthly() },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/marketing", (req, res) => {
  try {
    res.json({ success: true, data: getMarketingData() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/appointments/recent", (req, res) => {
  try {
    res.json({ success: true, data: getRecentAppointments() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/content", (req, res) => {
  try {
    res.json({ success: true, data: getContentSummary() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────
// Helper functions
// ─────────────────────────────────────────────
function getVisitorSummary() {
  const today = db
    .prepare(
      `
    SELECT COUNT(*) as count FROM visitor_logs
    WHERE DATE(created_at) = DATE('now','localtime')
  `,
    )
    .get();

  const month = db
    .prepare(
      `
    SELECT COUNT(*) as count FROM visitor_logs
    WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now','localtime')
  `,
    )
    .get();

  const total = db
    .prepare(
      `
    SELECT COUNT(*) as count FROM visitor_logs
  `,
    )
    .get();

  const fmt = (n) => (n ?? 0).toLocaleString("th-TH");

  return {
    today: fmt(today?.count),
    month: fmt(month?.count),
    total: fmt(total?.count),
  };
}

function getMarketingData() {
  const q = (sql) => db.prepare(sql).get()?.count ?? 0;
  return {
    consultations: q(`SELECT COUNT(*) as count FROM appointments`),
    packagesSold: q(
      `SELECT COUNT(*) as count FROM appointments WHERE status = 'done'`,
    ),
    successRate: q(
      `SELECT COUNT(*) as count FROM appointments WHERE status = 'cancelled'`,
    ),
    leadsCount: q(
      `SELECT COUNT(*) as count FROM appointments WHERE status = 'pending'`,
    ),
  };
}

function getVisitorMonthly() {
  const rows = db
    .prepare(
      `
    SELECT
      CAST(strftime('%m', created_at) AS INTEGER) AS month_num,
      COUNT(*) AS count
    FROM visitor_logs
    WHERE strftime('%Y', created_at) = strftime('%Y', 'now', 'localtime')
    GROUP BY month_num
  `,
    )
    .all();

  const byMonth = {};
  rows.forEach((r) => {
    byMonth[r.month_num] = r.count;
  });

  return Array.from({ length: 12 }, (_, i) => {
    const monthNum = i + 1; // เดือน 1 ถึง 12
    return byMonth[monthNum] ?? 0;
  });
}

function getRecentAppointments() {
  return db
    .prepare(
      `
    SELECT id, name, phone, email, service, status, created_at
    FROM appointments
    ORDER BY created_at DESC
    LIMIT 10
  `,
    )
    .all();
}

function getContentSummary() {
  const q = (sql) => db.prepare(sql).get()?.count ?? 0;
  return {
    articles: q(
      `SELECT COUNT(*) as count FROM articles WHERE status = 'published'`,
    ),
    drafts: q(`SELECT COUNT(*) as count FROM articles WHERE status = 'draft'`),
    videos: q(
      `SELECT COUNT(*) as count FROM videos   WHERE status = 'published'`,
    ),
    reviews: q(
      `SELECT COUNT(*) as count FROM reviews  WHERE status = 'published'`,
    ),
    doctors: q(
      `SELECT COUNT(*) as count FROM doctors  WHERE status = 'published'`,
    ),
    faqs: q(
      `SELECT COUNT(*) as count FROM faqs     WHERE status = 'published'`,
    ),
    stories: q(
      `SELECT COUNT(*) as count FROM stories  WHERE status = 'published'`,
    ),
  };
}

module.exports = router;
