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

  CREATE TABLE IF NOT EXISTS visitor_logs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    ip         TEXT DEFAULT '',
    path       TEXT DEFAULT '/',
    user_agent TEXT DEFAULT '',
    referrer   TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );
`);

// Refresh Tokens
db.exec(`
  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id   INTEGER NOT NULL,
    token      TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
  )
`);

// ─────────────────────────────────────────────
// Runtime column migrations (idempotent)
// ─────────────────────────────────────────────
function addColumnIfMissing(table, column, type) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.find((c) => c.name === column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`).run();
    console.log(`Migrated: ${table}.${column}`);
  }
}

addColumnIfMissing("appointments", "appointment_date", "TEXT DEFAULT ''");
addColumnIfMissing("visitor_logs", "referrer", "TEXT DEFAULT ''");

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
// Seed default admin account
// ─────────────────────────────────────────────
function seedAdmin() {
  const crypto = require("crypto");

  // ตรวจสอบและสร้าง Admin หลักหากยังไม่มี เพื่อให้ระบบสามารถ Login ได้
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
}

seedAdmin();

module.exports = db;
