# IVF Wellness — CMS API Backend

Backend API สำหรับเว็บไซต์ IVF Wellness พร้อม Admin Panel จัดการเนื้อหาครบวงจร

## Stack
- **Node.js** + **Express** — REST API
- **SQLite** (better-sqlite3) — ฐานข้อมูล ไม่ต้องติดตั้ง DB Server
- **JWT** — Authentication
- **Multer** — อัพโหลดรูปภาพ/วิดีโอ

---

## การติดตั้ง

### 1. ติดตั้ง Dependencies

```bash
cd ivf-api
npm install
```

### 2. ตั้งค่า Environment

```bash
cp .env.example .env
```

แก้ไขไฟล์ `.env`:

```env
PORT=4000
JWT_SECRET=your-super-secret-key-change-this   # เปลี่ยนให้ปลอดภัย!
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin1234                         # เปลี่ยนหลัง deploy
FRONTEND_URL=http://localhost:3000
```

### 3. เริ่มต้น Server

```bash
# Development (auto-restart)
npm run dev

# Production
npm start
```

Server จะรันที่:
- **API**: http://localhost:4000/api
- **Admin Panel**: http://localhost:4000/admin

**Default Login**: `admin` / `admin1234`  
⚠️ เปลี่ยนรหัสผ่านหลัง deploy ผ่าน Admin Panel > เปลี่ยนรหัสผ่าน

---

## Admin Panel Features

| หน้า | ฟีเจอร์ |
|------|---------|
| 📊 Dashboard | สถิติรวมทั้งหมด |
| 📝 บทความ | เพิ่ม/แก้ไข/ลบบทความ, อัพโหลดรูปปก, ตั้งสถานะ draft/published |
| 🎬 วิดีโอ | เพิ่ม YouTube/TikTok URL, อัพโหลด thumbnail |
| ⭐ รีวิว | จัดการรีวิวผู้ป่วย, ตั้ง Featured, คะแนน |
| 👨‍⚕️ ทีมแพทย์ | เพิ่มแพทย์, ประวัติ, การศึกษา, ความเชี่ยวชาญ |
| ❓ FAQ | เพิ่ม/แก้ไขคำถาม-คำตอบ, จัดกลุ่มหมวดหมู่ |
| 📞 ข้อมูลติดต่อ | แก้ไขเบอร์โทร, ที่อยู่, เวลาทำการ |
| 📱 Social Media | จัดการ Facebook, LINE, Instagram, YouTube |
| 🔑 รหัสผ่าน | เปลี่ยนรหัสผ่าน Admin |

---

## API Endpoints

### Auth
```
POST /api/auth/login          — เข้าสู่ระบบ
GET  /api/auth/me             — ข้อมูล admin ปัจจุบัน
POST /api/auth/change-password — เปลี่ยนรหัสผ่าน
```

### Articles (Public)
```
GET  /api/articles            — ดึงบทความ (published)
GET  /api/articles/:id        — ดึงบทความเดี่ยว
```

### Articles (Admin — ต้องใช้ Bearer Token)
```
GET  /api/articles/admin/all  — ดึงทั้งหมด
POST /api/articles            — เพิ่มบทความ (multipart/form-data)
PUT  /api/articles/:id        — แก้ไข
DEL  /api/articles/:id        — ลบ
```

### Videos, Reviews, Doctors — รูปแบบเดียวกัน
```
GET  /api/videos
GET  /api/videos/admin/all    (auth)
POST /api/videos              (auth)
PUT  /api/videos/:id          (auth)
DEL  /api/videos/:id          (auth)

GET  /api/reviews
GET  /api/reviews/admin/all   (auth)
POST /api/reviews             (auth)
...

GET  /api/doctors
GET  /api/doctors/admin/all   (auth)
POST /api/doctors             (auth)
...
```

### FAQs
```
GET  /api/faqs                — ดึง FAQ จัดกลุ่มตาม category
GET  /api/faqs/admin/all      (auth)
POST /api/faqs                (auth)
PUT  /api/faqs/:id            (auth)
DEL  /api/faqs/:id            (auth)
```

### Settings
```
GET  /api/settings/contact          — ข้อมูลติดต่อ + เวลาทำการ
PUT  /api/settings/contact          (auth)
GET  /api/settings/social           — Social Media (active)
GET  /api/settings/social/admin     (auth)
PUT  /api/settings/social           (auth)
```

---

## เชื่อมกับ Nuxt Frontend

### ติดตั้ง plugin ใน Nuxt

เพิ่มไฟล์ `plugins/api.js` ใน Nuxt project:

```js
// plugins/api.js
export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const apiBase = config.public.apiBase || 'http://localhost:4000/api'

  return {
    provide: {
      api: {
        get: (path) => fetch(`${apiBase}${path}`).then(r => r.json()),
      }
    }
  }
})
```

เพิ่มใน `nuxt.config.ts`:

```ts
runtimeConfig: {
  public: {
    apiBase: process.env.API_BASE || 'http://localhost:4000/api'
  }
}
```

### ตัวอย่างใช้งานใน Page

```vue
<script setup>
const { $api } = useNuxtApp()

// ดึงบทความ
const { data: articles } = await useAsyncData('articles', () => 
  $api.get('/articles?limit=6')
)

// ดึง FAQ
const { data: faqs } = await useAsyncData('faqs', () => 
  $api.get('/faqs')
)

// ดึงข้อมูลติดต่อ
const { data: contact } = await useAsyncData('contact', () => 
  $api.get('/settings/contact')
)

// ดึงทีมแพทย์
const { data: doctors } = await useAsyncData('doctors', () => 
  $api.get('/doctors')
)
</script>
```

---

## โครงสร้างไฟล์

```
ivf-api/
├── server.js              — Main entry point
├── db.js                  — Database init + seed data
├── .env.example           — Environment template
├── package.json
├── routes/
│   ├── auth.js            — Login, logout
│   ├── articles.js        — CRUD บทความ
│   ├── videos.js          — CRUD วิดีโอ
│   ├── reviews.js         — CRUD รีวิว
│   ├── faqs.js            — CRUD FAQ
│   ├── doctors.js         — CRUD ทีมแพทย์
│   └── settings.js        — ข้อมูลติดต่อ, Social Media
├── middleware/
│   └── auth.js            — JWT verification
├── admin-panel/
│   └── index.html         — Admin CMS UI
└── uploads/               — ไฟล์ที่อัพโหลด
    ├── articles/
    ├── videos/
    ├── reviews/
    └── doctors/
```

---

## Production Notes

1. เปลี่ยน `JWT_SECRET` ให้เป็น random string ยาวๆ
2. เปลี่ยนรหัสผ่าน admin หลัง deploy
3. ใช้ Nginx reverse proxy สำหรับ production
4. ตั้ง CORS ให้ตรงกับ domain จริง ใน `.env > FRONTEND_URL`
5. Backup ไฟล์ `ivf-wellness.db` สม่ำเสมอ
