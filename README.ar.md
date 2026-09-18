<div dir="rtl" align="center">

# 💬 تطبيق المحادثة — منصة مراسلة فورية

**تطبيق محادثات متكامل، مستوحى من واتساب وتلغرام، جاهز للإنتاج**

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-7-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4-010101?logo=socket.io&logoColor=white)](https://socket.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

[المعاينة المباشرة](#-المعاينة-المباشرة) •
[المميزات](#-المميزات) •
[التقنيات](#-التقنيات-المستخدمة) •
[التشغيل-السريع](#-التشغيل-السريع) •
[البنية](#-بنية-المشروع) •
[النشر](#-النشر) •
[الرخصة](#-الرخصة)

</div>

---

<div dir="rtl">

**🌍 اللغات:** [English](./README.md) • [العربية](./README.ar.md)

---

## 🚀 المعاينة المباشرة

> **جرّبه الآن — دون أي تثبيت!**

| الخدمة                                | الرابط                                                                                       | الحالة                                                            |
| ------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **🌐 تطبيق الويب (الواجهة الأمامية)** | [https://YOUR_USERNAME.github.io/chat-app/](https://YOUR_USERNAME.github.io/chat-app/)       | ![الحالة](https://img.shields.io/badge/status-online-brightgreen) |
| **🖥 الـ API (الواجهة الخلفية)**      | [https://chat-app-api.onrender.com](https://chat-app-api.onrender.com)                       | ![الحالة](https://img.shields.io/badge/status-online-brightgreen) |
| **❤️ فحص الصحة**                      | [https://chat-app-api.onrender.com/api/health](https://chat-app-api.onrender.com/api/health) | ![الحالة](https://img.shields.io/badge/status-online-brightgreen) |

> ⚠️ **ملاحظة:** الخادم مستضاف على الخطة المجانية من Render. الطلب الأول قد يستغرق **30–60 ثانية** (Cold Start). الطلبات التالية سريعة.

### 🎬 جرّب هذه المميزات

1. أنشئ حساباً جديداً.
2. افتح متصفحاً آخر (وضع التخفي) وأنشئ مستخدماً آخر.
3. ابدأ محادثة، أرسل رسائل، تفاعل بإيموجي، وأجرِ مكالمة صوتية/مرئية.
4. جرّب التبديل بين **العربية (RTL)** و**الإنجليزية (LTR)**.
5. جرّب **الوضع الليلي/النهاري**.

---

## 📸 لقطات الشاشة

### 💬 صفحة المحادثة

![صفحة المحادثة](./docs/screenshots/chat.png)

### 📞 المكالمات الصوتية والمرئية

![المكالمات](./docs/screenshots/call.png)

### 👥 إدارة المجموعات

![المجموعات](./docs/screenshots/group.png)

### ⚙️ الإعدادات (الوضع الليلي)

![الإعدادات](./docs/screenshots/settings-dark.png)

### 🌍 دعم العربية RTL

![العربية](./docs/screenshots/arabic.png)

> _اللقطات قادمة قريباً — استبدلها بلقطاتك بعد النشر._

---

## 📖 نظرة عامة

**تطبيق المحادثة** هو منصة مراسلة فورية حديثة متكاملة (Full-Stack) تدعم:

- الرسائل النصية والصوتية والمرئية والملفات في الوقت الفعلي
- المكالمات الصوتية والمرئية بين المستخدمين مباشرة عبر WebRTC
- المحادثات الجماعية مع صلاحيات دقيقة للمشرفين
- إعدادات خصوصية كاملة (آخر ظهور، الصورة، إيصالات القراءة)
- دعم كامل للعربية (RTL) والإنجليزية (LTR)
- الوضع الليلي والنهاري
- الإشعارات الفورية عبر Firebase Cloud Messaging

بُني التطبيق باستخدام **React + Vite** في الواجهة الأمامية، و**Node.js + Express + MongoDB + Socket.IO** في الواجهة الخلفية، ويتبع مبادئ التصميم النظيف، وهو جاهز للنشر على خدمات مجانية بالكامل.

---

## ✨ المميزات

### 💬 المراسلة

- رسائل نصية فورية مع إيصالات التسليم والقراءة (`✓` / `✓✓` / `✓✓` بالأزرق)
- الرد على الرسائل، إعادة التوجيه، التعديل، والحذف (لي / للجميع)
- تفاعلات إيموجي (❤️ 👍 😂 😮 😢 🙏)
- رسائل الوسائط: صور، فيديو، رسائل صوتية، وملفات
- البحث في الرسائل داخل المحادثة
- الملفات المحفوظة (Starred)
- الرسائل المؤقتة (Disappearing Messages)
- معلومات الرسالة (من قرأ، ومن استلم)
- معاينة الروابط (Link Previews)

### 👥 جهات الاتصال والمحادثات

- محادثات فردية وجماعية
- مؤشر الكتابة، الحضور (Online/Offline)، وآخر ظهور
- عدّاد الرسائل غير المقروءة لكل محادثة
- تثبيت (Pin)، أرشفة (Archive)، وكتم (Mute) المحادثات
- حظر وإلغاء حظر المستخدمين

### 👨‍👩‍👧 المجموعات

- إنشاء مجموعات متعددة الأعضاء
- ترقية وتنزيل المشرفين
- تعديل صورة المجموعة، اسمها، ووصفها
- صلاحيات دقيقة (من يمكنه الإرسال، الإضافة، التعديل)
- رسائل نظام تلقائية ("أحمد أضاف سارة")
- مغادرة أو حذف المجموعة (للمالك فقط)

### 📞 المكالمات (WebRTC)

- مكالمات **صوتية** و**مرئية** مباشرة بين المستخدمين
- مكالمات جماعية
- مشاركة الشاشة
- صورة داخل صورة (PiP)
- كتم الميكروفون، تشغيل/إيقاف الكاميرا، تبديل الكاميرا
- سجل المكالمات مع المدة والحالة
- إشعارات المكالمات الواردة مع رنين

### 🔔 الإشعارات

- إشعارات Push عبر Firebase Cloud Messaging
- إشعارات في الخلفية والأمامية
- النقر على الإشعار يفتح المحادثة الصحيحة

### 🎨 تجربة المستخدم

- **تصميم متجاوب بالكامل** — جوال، تابلت، وسطح مكتب
- الوضع **الليلي / النهاري / النظام**
- **العربية والإنجليزية** مع تبديل RTL/LTR تلقائي
- حركات سلسة وتصميم عصري
- اختصارات لوحة المفاتيح وواجهة يسهل الوصول إليها

### 🔒 الأمان

- JWT access + refresh tokens
- تشفير كلمات المرور بـ bcrypt
- Rate limiting على المصادقة والرسائل
- تعقيم المدخلات (XSS، NoSQL Injection، HPP)
- تقوية ترويسات HTTP بـ Helmet
- احترام إعدادات الخصوصية في كل الـ APIs

---

## 🛠 التقنيات المستخدمة

### الواجهة الأمامية

| التقنية                           | الوظيفة                   |
| --------------------------------- | ------------------------- |
| **React 18**                      | مكتبة واجهات المستخدم     |
| **Vite**                          | أداة البناء وخادم التطوير |
| **React Router 6**                | التوجيه في الواجهة        |
| **Bootstrap 5 + React-Bootstrap** | مكونات UI متجاوبة         |
| **Socket.IO Client**              | التواصل الفوري            |
| **Axios**                         | عميل HTTP                 |
| **i18next + react-i18next**       | الترجمة (عربي/إنجليزي)    |
| **date-fns**                      | تنسيق التواريخ            |
| **Firebase SDK**                  | الإشعارات الفورية         |
| **Sass**                          | الأنماط المخصصة           |

### الواجهة الخلفية

| التقنية                 | الوظيفة              |
| ----------------------- | -------------------- |
| **Node.js 20**          | بيئة التشغيل         |
| **Express 4**           | إطار العمل           |
| **MongoDB + Mongoose**  | قاعدة البيانات و ODM |
| **Socket.IO 4**         | خادم الوقت الفعلي    |
| **JWT**                 | المصادقة             |
| **Bcrypt**              | تشفير كلمات المرور   |
| **Multer + Cloudinary** | رفع الملفات والتخزين |
| **Firebase Admin**      | الإشعارات الفورية    |
| **Express Validator**   | التحقق من المدخلات   |
| **Helmet / CORS / HPP** | الأمان               |

### البنية التحتية

| الخدمة               | الوظيفة                    | التكلفة     |
| -------------------- | -------------------------- | ----------- |
| **MongoDB Atlas**    | قاعدة بيانات سحابية        | مجاني (M0)  |
| **Render**           | استضافة الواجهة الخلفية    | مجاني       |
| **GitHub Pages**     | استضافة الواجهة الأمامية   | مجاني       |
| **Cloudinary**       | CDN للوسائط                | طبقة مجانية |
| **Metered / Xirsys** | خوادم TURN للمكالمات       | طبقة مجانية |
| **UptimeRobot**      | الحفاظ على الخادم مستيقظاً | مجاني       |
| **Firebase**         | الإشعارات الفورية          | مجاني       |

---

## 🚀 التشغيل السريع

### المتطلبات

- **Node.js** ≥ 18
- **npm** أو **yarn**
- **MongoDB** (محلي أو حساب Atlas)
- **Git**

### 1. استنساخ المستودع

```bash
git clone https://github.com/YOUR_USERNAME/chat-app.git
cd chat-app
```

### 2. تهيئة الواجهة الخلفية

```bash
cd server
npm install
cp .env.example .env       # ثم عدّل .env
npm run dev
```

الخادم سيعمل على **http://localhost:5000**.

### 3. تهيئة الواجهة الأمامية

```bash
cd ../client
npm install
cp .env.example .env       # ثم عدّل .env
npm run dev
```

التطبيق سيفتح على **http://localhost:3000**.

### 4. إنشاء أول حساب

افتح التطبيق، اضغط **إنشاء حساب**، وأنشئ مستخدماً. افتح متصفحاً آخر (وضع التخفي)، أنشئ مستخدماً آخر، وابدأ المحادثة.

---

## 📂 بنية المشروع

```
chat-app/
├── client/                       # واجهة React الأمامية
│   ├── public/
│   │   ├── locales/              # ملفات الترجمة
│   │   └── firebase-messaging-sw.js
│   ├── src/
│   │   ├── components/           # مكونات قابلة لإعادة الاستخدام
│   │   ├── context/              # React contexts
│   │   ├── hooks/                # Hooks مخصصة
│   │   ├── pages/                # صفحات المسارات
│   │   ├── services/             # طبقة خدمات API
│   │   ├── styles/               # SCSS العام
│   │   ├── utils/                # أدوات مساعدة
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── package.json
│
├── server/                       # خادم Node.js
│   ├── config/                   # DB, Socket.IO, Firebase
│   ├── controllers/              # معالجات الطلبات
│   ├── middleware/               # المصادقة والأخطاء والأمان
│   ├── models/                   # نماذج Mongoose
│   ├── routes/                   # مسارات Express
│   ├── utils/                    # أدوات مساعدة
│   ├── server.js
│   └── package.json
│
├── README.md                     # ← الإنجليزي
├── README.ar.md                  # ← العربي (هذا الملف)
└── LICENSE
```

---

## 🏗 البنية المعمارية

```
┌───────────────────────────────────────────────────────────────┐
│                     العميل (React + Vite)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐     │
│  │  REST API    │  │  Socket.IO   │  │  WebRTC (P2P)    │     │
│  │  (Axios)     │  │  (فوري)      │  │  (مكالمات)       │     │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘     │
└─────────┼─────────────────┼───────────────────┼───────────────┘
          │                 │                   │
          │ HTTP / JSON     │ WebSocket         │ UDP (SRTP)
          │                 │                   │
          ▼                 ▼                   ▼
┌───────────────────────────────────────────────────────────────┐
│                    الخادم (Node.js + Express)                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐     │
│  │  REST API    │  │  Socket.IO   │  │  Signaling       │     │
│  │  Controllers │  │  Handlers    │  │  (WebRTC)        │     │
│  └──────┬───────┘  └──────┬───────┘  └──────────────────┘     │
└─────────┼─────────────────┼───────────────────────────────────┘
          │                 │
          ▼                 ▼
┌───────────────────┐  ┌─────────────────┐  ┌──────────────────┐
│  MongoDB Atlas    │  │   Cloudinary    │  │  Firebase FCM    │
│  (المستخدمون،    │  │   (وسائط)       │  │  (الإشعارات)     │
│   الرسائل، إلخ)  │  │                 │  │                  │
└───────────────────┘  └─────────────────┘  └──────────────────┘
```

---

## 🔑 متغيرات البيئة

### الواجهة الخلفية (`server/.env`)

```env
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/chat_app

JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your_refresh_secret
JWT_REFRESH_EXPIRES_IN=7d

CLIENT_URL=http://localhost:3000

# Firebase
FIREBASE_SERVICE_ACCOUNT_PATH=./config/firebase-service-account.json

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### الواجهة الأمامية (`client/.env`)

```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
VITE_UPLOADS_URL=http://localhost:5000

# Firebase Web Config
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_VAPID_KEY=...

# TURN
VITE_METERED_API_KEY=...
VITE_METERED_APP_NAME=...
```

---

## 🌐 النشر

التطبيق مُصمّم للنشر **بالكامل على خدمات مجانية**.

| المكوّن           | الخدمة               | التكلفة             |
| ----------------- | -------------------- | ------------------- |
| الواجهة الأمامية  | GitHub Pages         | مجاني               |
| الواجهة الخلفية   | Render (Web Service) | مجاني               |
| قاعدة البيانات    | MongoDB Atlas M0     | مجاني               |
| تخزين الوسائط     | Cloudinary           | طبقة مجانية         |
| الإشعارات         | Firebase             | مجاني               |
| TURN              | Metered Open Relay   | 20 GB شهرياً مجاناً |
| الحفاظ على النشاط | UptimeRobot          | مجاني               |

### خطوات النشر السريعة

1. **قاعدة البيانات** → أنشئ Cluster مجاني على MongoDB Atlas وانسخ رابط الاتصال.
2. **الواجهة الخلفية** → ارفعها على GitHub، ثم انشرها على Render، واضبط متغيرات البيئة.
3. **الواجهة الأمامية** → اضبط `base` في `vite.config.js`، استخدم `HashRouter`، ثم `npm run deploy`.
4. **TURN** → سجّل في Metered، وأضف بيانات الاعتماد في `.env` للواجهة.
5. **الحفاظ على النشاط** → أضف مراقب UptimeRobot لمنع Render من "النوم".

> دليل النشر الكامل متوفر في [`docs/DEPLOYMENT.ar.md`](./docs/DEPLOYMENT.ar.md).

---

## 🧪 الاختبارات

```bash
# الواجهة الخلفية
cd server
npm test

# الواجهة الأمامية
cd client
npm run test
```

---

## 🤝 المساهمة

المساهمات مرحب بها! اتبع الخطوات:

1. اعمل Fork للمستودع.
2. أنشئ فرعاً للميزة (`git checkout -b feature/amazing-feature`).
3. اعمل commit للتغييرات (`git commit -m 'Add amazing feature'`).
4. ارفع الفرع (`git push origin feature/amazing-feature`).
5. افتح Pull Request.

---

## 📄 الرخصة

هذا المشروع مُرخّص تحت **رخصة MIT** — راجع ملف [LICENSE](./LICENSE) للتفاصيل.

---

## 👤 المؤلف

**اسمك هنا**

- GitHub: [@YOUR_USERNAME](https://github.com/YOUR_USERNAME)
- البريد: your.email@example.com
- الموقع: [your-website.com](https://your-website.com)

---

## 🙏 شكر وتقدير

- [WhatsApp](https://whatsapp.com) و [Telegram](https://telegram.org) للإلهام
- [Socket.IO](https://socket.io) للتواصل الفوري
- [WebRTC](https://webrtc.org) للوسائط بين الأقران
- مجتمع المصادر المفتوحة على المكتبات الممتازة

---

<div align="center">

**⭐ إذا وجدت هذا المشروع مفيداً، لا تنسَ إعطاءه نجمة!**

صُنع بـ ❤️ بواسطة [اسمك](https://github.com/YOUR_USERNAME)

</div>

</div>
