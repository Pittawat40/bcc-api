// db.js - Database initialization with better-sqlite3
const Database = require("better-sqlite3");
const path = require("path");

const DB_PATH = path.join(__dirname, "ivf-wellness.db");
const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ─────────────────────────────────────────────
// Create / Migrate Tables
// ─────────────────────────────────────────────
db.exec(`
  -- Admin users
  CREATE TABLE IF NOT EXISTS admins (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    username    TEXT UNIQUE NOT NULL,
    password    TEXT NOT NULL,
    created_at  TEXT DEFAULT (datetime('now','localtime'))
  );

  -- Articles / Blog posts
  CREATE TABLE IF NOT EXISTS articles (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    title_en    TEXT DEFAULT '',
    slug        TEXT UNIQUE NOT NULL,
    excerpt     TEXT DEFAULT '',
    excerpt_en  TEXT DEFAULT '',
    content     TEXT DEFAULT '',
    content_en  TEXT DEFAULT '',
    cover_image TEXT,
    category    TEXT DEFAULT 'general',
    tags        TEXT DEFAULT '[]',
    status      TEXT DEFAULT 'draft',
    views       INTEGER DEFAULT 0,
    created_at  TEXT DEFAULT (datetime('now','localtime')),
    updated_at  TEXT DEFAULT (datetime('now','localtime'))
  );

  -- Videos
  CREATE TABLE IF NOT EXISTS videos (
    id             TEXT PRIMARY KEY,
    title          TEXT NOT NULL,
    title_en       TEXT DEFAULT '',
    description    TEXT DEFAULT '',
    description_en TEXT DEFAULT '',
    url            TEXT,
    thumbnail      TEXT,
    category       TEXT DEFAULT 'general',
    status         TEXT DEFAULT 'published',
    views          INTEGER DEFAULT 0,
    created_at     TEXT DEFAULT (datetime('now','localtime')),
    updated_at     TEXT DEFAULT (datetime('now','localtime'))
  );

  -- Reviews
  CREATE TABLE IF NOT EXISTS reviews (
    id             TEXT PRIMARY KEY,
    author_name    TEXT NOT NULL,
    author_name_en TEXT DEFAULT '',
    date           TEXT DEFAULT '',
    content        TEXT NOT NULL,
    content_en     TEXT DEFAULT '',
    rating         INTEGER DEFAULT 5,
    avatar_bg      TEXT DEFAULT 'bg-brand-400',
    category       TEXT DEFAULT 'IVF',
    is_featured    INTEGER DEFAULT 0,
    status         TEXT DEFAULT 'published',
    created_at     TEXT DEFAULT (datetime('now','localtime')),
    updated_at     TEXT DEFAULT (datetime('now','localtime'))
  );

  -- Appointments
  CREATE TABLE IF NOT EXISTS appointments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    phone       TEXT NOT NULL,
    email       TEXT DEFAULT '',
    service     TEXT DEFAULT '',
    message     TEXT DEFAULT '',
    status      TEXT DEFAULT 'pending',
    note        TEXT DEFAULT '',
    created_at  TEXT DEFAULT (datetime('now','localtime')),
    updated_at  TEXT DEFAULT (datetime('now','localtime'))
  );

  -- FAQ
  CREATE TABLE IF NOT EXISTS faqs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    question    TEXT NOT NULL,
    question_en TEXT DEFAULT '',
    answer      TEXT NOT NULL,
    answer_en   TEXT DEFAULT '',
    category    TEXT DEFAULT 'ทั่วไป',
    sort_order  INTEGER DEFAULT 0,
    status      TEXT DEFAULT 'published',
    created_at  TEXT DEFAULT (datetime('now','localtime')),
    updated_at  TEXT DEFAULT (datetime('now','localtime'))
  );

  -- Doctors
  CREATE TABLE IF NOT EXISTS doctors (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    name_en      TEXT DEFAULT '',
    title        TEXT DEFAULT '',
    title_en     TEXT DEFAULT '',
    bio          TEXT DEFAULT '',
    bio_en       TEXT DEFAULT '',
    photo        TEXT,
    education    TEXT DEFAULT '[]',
    education_en TEXT DEFAULT '[]',
    specialties  TEXT DEFAULT '[]',
    avatar_grad  TEXT DEFAULT 'from-brand-400 to-brand-600',
    sort_order   INTEGER DEFAULT 0,
    status       TEXT DEFAULT 'published',
    created_at   TEXT DEFAULT (datetime('now','localtime')),
    updated_at   TEXT DEFAULT (datetime('now','localtime'))
  );

  -- Contact Info
  CREATE TABLE IF NOT EXISTS contact_info (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    key        TEXT UNIQUE NOT NULL,
    label      TEXT NOT NULL,
    value      TEXT NOT NULL,
    href       TEXT,
    icon       TEXT,
    sort_order INTEGER DEFAULT 0
  );

  -- Business Hours
  CREATE TABLE IF NOT EXISTS business_hours (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    day_label  TEXT NOT NULL,
    hours      TEXT NOT NULL,
    is_closed  INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0
  );

  -- Success Stories
  CREATE TABLE IF NOT EXISTS stories (
    id         TEXT PRIMARY KEY,
    title      TEXT NOT NULL,
    title_en   TEXT DEFAULT '',
    author     TEXT DEFAULT '',
    author_en  TEXT DEFAULT '',
    date       TEXT DEFAULT '',
    treatment  TEXT DEFAULT '',
    cycle      TEXT DEFAULT '',
    story      TEXT NOT NULL,
    story_en   TEXT DEFAULT '',
    image      TEXT,
    status     TEXT DEFAULT 'published',
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  );

  -- Social Media
  CREATE TABLE IF NOT EXISTS social_media (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    platform   TEXT UNIQUE NOT NULL,
    url        TEXT NOT NULL,
    label      TEXT,
    icon       TEXT,
    is_active  INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0
  );

  -- Gallery
  CREATE TABLE IF NOT EXISTS gallery (
    id         TEXT PRIMARY KEY,
    caption_th TEXT DEFAULT '',
    caption_en TEXT DEFAULT '',
    media_url  TEXT NOT NULL,
    media_type TEXT DEFAULT 'image',
    col_span   TEXT DEFAULT 'md:col-span-4',
    row_span   TEXT DEFAULT 'md:row-span-1',
    sort_order INTEGER DEFAULT 0,
    status     TEXT DEFAULT 'published',
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  );
`);

// ─────────────────────────────────────────────
// Runtime column migrations (idempotent)
// ─────────────────────────────────────────────
function addColumnIfMissing(table, column, type) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.find((c) => c.name === column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`).run();
    console.log(`✅ Migrated: ${table}.${column}`);
  }
}

// Articles
addColumnIfMissing("articles", "title_en", "TEXT DEFAULT ''");
addColumnIfMissing("articles", "excerpt_en", "TEXT DEFAULT ''");
addColumnIfMissing("articles", "content_en", "TEXT DEFAULT ''");

// Videos
addColumnIfMissing("videos", "title_en", "TEXT DEFAULT ''");
addColumnIfMissing("videos", "description_en", "TEXT DEFAULT ''");

// Reviews
addColumnIfMissing("reviews", "author_name_en", "TEXT DEFAULT ''");
addColumnIfMissing("reviews", "date", "TEXT DEFAULT ''");
addColumnIfMissing("reviews", "content_en", "TEXT DEFAULT ''");

// FAQs
addColumnIfMissing("faqs", "question_en", "TEXT DEFAULT ''");
addColumnIfMissing("faqs", "answer_en", "TEXT DEFAULT ''");

// Doctors
addColumnIfMissing("doctors", "name_en", "TEXT DEFAULT ''");
addColumnIfMissing("doctors", "title_en", "TEXT DEFAULT ''");
addColumnIfMissing("doctors", "bio_en", "TEXT DEFAULT ''");
addColumnIfMissing("doctors", "education_en", "TEXT DEFAULT '[]'");

// Stories
addColumnIfMissing("stories", "title_en", "TEXT DEFAULT ''");
addColumnIfMissing("stories", "story_en", "TEXT DEFAULT ''");
addColumnIfMissing("stories", "author_en", "TEXT DEFAULT ''");

// ─────────────────────────────────────────────
// Seed default data if empty
// ─────────────────────────────────────────────
function seedIfEmpty() {
  const crypto = require("crypto");

  // Admin
  const adminExists = db
    .prepare("SELECT id FROM admins WHERE username = ?")
    .get("admin");
  if (!adminExists) {
    const pass = process.env.ADMIN_PASSWORD || "admin1234";
    const hashed = crypto.createHash("sha256").update(pass).digest("hex");
    db.prepare("INSERT INTO admins (username, password) VALUES (?, ?)").run(
      "admin",
      hashed,
    );
    console.log("✅ Default admin created: admin / admin1234");
  }

  // Contact Info
  const contactExists = db.prepare("SELECT id FROM contact_info LIMIT 1").get();
  if (!contactExists) {
    const contacts = [
      {
        key: "phone",
        label: "โทรศัพท์",
        value: "02-xxx-xxxx",
        href: "tel:02xxxxxxx",
        icon: "phone",
        sort_order: 1,
      },
      {
        key: "line",
        label: "LINE",
        value: "@bcc-ivf",
        href: "https://line.me/R/ti/p/@bcc-ivf",
        icon: "line",
        sort_order: 2,
      },
      {
        key: "email",
        label: "อีเมล",
        value: "info@bcc-ivf.com",
        href: "mailto:info@bcc-ivf.com",
        icon: "email",
        sort_order: 3,
      },
      {
        key: "address",
        label: "ที่อยู่",
        value: "กรุงเทพมหานคร",
        href: null,
        icon: "map",
        sort_order: 4,
      },
    ];
    const stmt = db.prepare(
      "INSERT INTO contact_info (key,label,value,href,icon,sort_order) VALUES (?,?,?,?,?,?)",
    );
    contacts.forEach((c) =>
      stmt.run(c.key, c.label, c.value, c.href, c.icon, c.sort_order),
    );
  }

  // Social Media
  const socialExists = db.prepare("SELECT id FROM social_media LIMIT 1").get();
  if (!socialExists) {
    const socials = [
      {
        platform: "facebook",
        url: "https://facebook.com/bcc-ivf",
        label: "Facebook",
        icon: "facebook",
        sort_order: 1,
      },
      {
        platform: "line",
        url: "https://line.me/R/ti/p/@bcc-ivf",
        label: "LINE OA",
        icon: "line",
        sort_order: 2,
      },
      {
        platform: "instagram",
        url: "https://instagram.com/bcc-ivf",
        label: "Instagram",
        icon: "instagram",
        sort_order: 3,
      },
      {
        platform: "youtube",
        url: "https://youtube.com/@bcc-ivf",
        label: "YouTube",
        icon: "youtube",
        sort_order: 4,
      },
    ];
    const stmt = db.prepare(
      "INSERT INTO social_media (platform,url,label,icon,sort_order) VALUES (?,?,?,?,?)",
    );
    socials.forEach((s) =>
      stmt.run(s.platform, s.url, s.label, s.icon, s.sort_order),
    );
  }

  // Sample FAQ
  const faqExists = db.prepare("SELECT id FROM faqs LIMIT 1").get();
  if (!faqExists) {
    db.prepare(
      "INSERT INTO faqs (question,question_en,answer,answer_en,category,sort_order,status) VALUES (?,?,?,?,?,?,?)",
    ).run(
      "IVF คืออะไร?",
      "What is IVF?",
      "IVF (In Vitro Fertilization) คือการทำเด็กหลอดแก้ว โดยการนำไข่และอสุจิมาผสมกันนอกร่างกาย",
      "IVF (In Vitro Fertilization) is a process where eggs and sperm are combined outside the body.",
      "เกี่ยวกับ IVF",
      1,
      "published",
    );
  }

  // Sample Doctor
  const doctorExists = db.prepare("SELECT id FROM doctors LIMIT 1").get();
  if (!doctorExists) {
    const { v4: uuidv4 } = require("uuid");
    db.prepare(
      "INSERT INTO doctors (id,name,name_en,title,title_en,bio,bio_en,education,education_en,specialties,avatar_grad,sort_order,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
    ).run(
      uuidv4(),
      "รศ.ดร.นพ. วิชัย สุขใจ",
      "Assoc.Prof.Dr. Wichai Sukjai",
      "แพทย์เฉพาะทางเวชศาสตร์การเจริญพันธุ์",
      "Reproductive Medicine Specialist",
      "ผู้เชี่ยวชาญด้าน IVF และเวชศาสตร์การเจริญพันธุ์ประสบการณ์กว่า 15 ปี",
      "IVF and reproductive medicine specialist with over 15 years of experience.",
      JSON.stringify([
        "แพทยศาสตร์บัณฑิต มหาวิทยาลัยมหิดล",
        "วุฒิบัตร สูตินรีเวชศาสตร์",
      ]),
      JSON.stringify(["M.D., Mahidol University", "Board Certified OB/GYN"]),
      JSON.stringify(["IVF", "ICSI", "PGT"]),
      "from-brand-400 to-brand-600",
      1,
      "published",
    );
  }

  // Sample Gallery
  const galleryExists = db.prepare("SELECT id FROM gallery LIMIT 1").get();
  if (!galleryExists) {
    const { v4: uuidv4 } = require("uuid");
    const items = [
      {
        caption_th: "ห้องรับรองและปรึกษาแพทย์ ดีไซน์อบอุ่นเป็นกันเอง",
        caption_en: "Consultation & lounge area with a warm, welcoming design",
        media_url: "/images/consult.mp4",
        media_type: "video",
        col_span: "md:col-span-8",
        row_span: "md:row-span-1",
        sort_order: 1,
      },
      {
        caption_th: "เทคโนโลยีตู้เลี้ยงตัวอ่อนความละเอียดสูง",
        caption_en: "High-resolution embryo incubator technology",
        media_url: "/images/iui.mp4",
        media_type: "video",
        col_span: "md:col-span-4",
        row_span: "md:row-span-2",
        sort_order: 2,
      },
      {
        caption_th: "ทีมแพทย์และนักวิทยาศาสตร์ใส่ใจทุกรายละเอียด",
        caption_en:
          "Dedicated medical team and embryologists meticulously caring for details",
        media_url: "/images/doctor.mp4",
        media_type: "video",
        col_span: "md:col-span-4",
        row_span: "md:row-span-1",
        sort_order: 3,
      },
      {
        caption_th: "ห้องแล็บเลี้ยงตัวอ่อนระบบควบคุมความสะอาดระดับสูง",
        caption_en:
          "High-standard cleanroom system for the embryo cultivation lab",
        media_url: "/images/ivf.mp4",
        media_type: "video",
        col_span: "md:col-span-4",
        row_span: "md:row-span-1",
        sort_order: 4,
      },
    ];
    const stmt = db.prepare(
      "INSERT INTO gallery (id,caption_th,caption_en,media_url,media_type,col_span,row_span,sort_order,status) VALUES (?,?,?,?,?,?,?,?,?)",
    );
    items.forEach((g) =>
      stmt.run(
        uuidv4(),
        g.caption_th,
        g.caption_en,
        g.media_url,
        g.media_type,
        g.col_span,
        g.row_span,
        g.sort_order,
        "published",
      ),
    );
  }
}

seedIfEmpty();

module.exports = db;
