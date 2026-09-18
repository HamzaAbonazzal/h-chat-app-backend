<div align="center">

# 💬 Chat App — Real-Time Messaging Platform

**A full-stack, production-ready chat application inspired by WhatsApp & Telegram**

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-7-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4-010101?logo=socket.io&logoColor=white)](https://socket.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

[Live Demo](#-live-demo) •
[Features](#-features) •
[Tech Stack](#-tech-stack) •
[Quick Start](#-quick-start) •
[Architecture](#-architecture) •
[Deployment](#-deployment) •
[License](#-license)

</div>

---

**🌍 Languages:** [English](./README.md) • [العربية](./README.ar.md)

---

## 🚀 Live Demo

> **Try it now — no installation required!**

| Service                   | Link                                                                                         | Status                                                            |
| ------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **🌐 Web App (Frontend)** | [https://YOUR_USERNAME.github.io/chat-app/](https://YOUR_USERNAME.github.io/chat-app/)       | ![Status](https://img.shields.io/badge/status-online-brightgreen) |
| **🖥 API (Backend)**      | [https://chat-app-api.onrender.com](https://chat-app-api.onrender.com)                       | ![Status](https://img.shields.io/badge/status-online-brightgreen) |
| **❤️ Health Check**       | [https://chat-app-api.onrender.com/api/health](https://chat-app-api.onrender.com/api/health) | ![Status](https://img.shields.io/badge/status-online-brightgreen) |

> ⚠️ **Note:** The backend is hosted on Render's free tier. The first request may take **30–60 seconds** (cold start). Subsequent requests are fast.

### 🎬 Try these features

1. Register a new account.
2. Open a second browser (incognito) and register another user.
3. Start a chat, send messages, react with emojis, make a voice/video call.
4. Try switching between **Arabic (RTL)** and **English (LTR)**.
5. Toggle **Dark / Light** mode.

---

## 📸 Screenshots

### 💬 Chat Page

![Chat Page](./docs/screenshots/chat.png)

### 📞 Voice & Video Calls

![Calls](./docs/screenshots/call.png)

### 👥 Group Management

![Groups](./docs/screenshots/group.png)

### ⚙️ Settings (Dark Mode)

![Settings](./docs/screenshots/settings-dark.png)

### 🌍 Arabic RTL Support

![Arabic](./docs/screenshots/arabic.png)

> _Screenshots coming soon — replace these with your own after deployment._

---

## 📖 Overview

**Chat App** is a modern, full-stack real-time messaging platform that supports:

- Instant text, voice, video, and file messages
- Peer-to-peer audio and video calls powered by WebRTC
- Group conversations with granular admin permissions
- End-to-end user privacy controls (last seen, profile photo, read receipts)
- Full **Arabic (RTL)** and **English (LTR)** localization
- Light and dark themes
- Push notifications via Firebase Cloud Messaging

Built with a **React + Vite** frontend and a **Node.js + Express + MongoDB + Socket.IO** backend, the application follows clean architecture principles and is ready for production deployment on free-tier infrastructure.

---

## ✨ Features

### 💬 Messaging

- Real-time text messaging with delivery and read receipts (`✓` / `✓✓` / `✓✓` blue)
- Reply to, forward, edit, and delete messages (for me / for everyone)
- Emoji reactions (❤️ 👍 😂 😮 😢 🙏)
- Media messages: images, videos, voice notes, and files
- Message search within conversations
- Starred (saved) messages
- Disappearing messages
- Message info (who read, who received)
- Link previews for URLs

### 👥 Contacts & Conversations

- One-to-one and group conversations
- Typing indicators, online/offline presence, and last-seen timestamps
- Unread message counters per conversation
- Pin, archive, and mute conversations
- Block/unblock users

### 👨‍👩‍👧 Groups

- Create groups with multiple members
- Promote / demote admins
- Group avatar, name, and description editing
- Granular permissions (who can send, who can add, who can edit)
- Automatic system messages ("Ahmed added Sara")
- Leave or delete group (owner only)

### 📞 Calls (WebRTC)

- Peer-to-peer **audio** and **video** calls
- Group calls
- Screen sharing
- Picture-in-picture (PiP)
- Mute / camera toggle / switch camera
- Call history with durations and statuses
- Incoming call notifications with ringtone

### 🔔 Notifications

- Firebase Cloud Messaging (FCM) push notifications
- Background and foreground notification handling
- Click-to-open routing to the correct conversation

### 🎨 UI / UX

- **Fully responsive** — mobile, tablet, and desktop
- **Dark / Light / System** theme
- **Arabic + English** with automatic RTL/LTR switching
- Smooth animations and modern design
- Keyboard shortcuts and accessible UI

### 🔒 Security

- JWT access + refresh tokens
- Bcrypt password hashing
- Rate limiting on auth and messaging endpoints
- Input sanitization (XSS, NoSQL injection, HPP)
- Helmet HTTP header hardening
- Privacy controls respected across all APIs

---

## 🛠 Tech Stack

### Frontend

| Technology                        | Purpose                      |
| --------------------------------- | ---------------------------- |
| **React 18**                      | UI library                   |
| **Vite**                          | Build tool & dev server      |
| **React Router 6**                | Client-side routing          |
| **Bootstrap 5 + React-Bootstrap** | Responsive UI components     |
| **Socket.IO Client**              | Real-time communication      |
| **Axios**                         | HTTP client                  |
| **i18next + react-i18next**       | Internationalization (AR/EN) |
| **date-fns**                      | Date formatting              |
| **Firebase SDK**                  | Push notifications           |
| **Sass**                          | Custom styles                |

### Backend

| Technology              | Purpose                |
| ----------------------- | ---------------------- |
| **Node.js 20**          | Runtime                |
| **Express 4**           | Web framework          |
| **MongoDB + Mongoose**  | Database & ODM         |
| **Socket.IO 4**         | Real-time server       |
| **JWT**                 | Authentication         |
| **Bcrypt**              | Password hashing       |
| **Multer + Cloudinary** | File uploads & storage |
| **Firebase Admin**      | Push notifications     |
| **Express Validator**   | Input validation       |
| **Helmet / CORS / HPP** | Security               |

### Infrastructure

| Service              | Purpose                 | Cost      |
| -------------------- | ----------------------- | --------- |
| **MongoDB Atlas**    | Cloud database          | Free (M0) |
| **Render**           | Backend hosting         | Free      |
| **GitHub Pages**     | Frontend hosting        | Free      |
| **Cloudinary**       | Media CDN               | Free tier |
| **Metered / Xirsys** | TURN servers for WebRTC | Free tier |
| **UptimeRobot**      | Keep-alive monitoring   | Free      |
| **Firebase**         | Push notifications      | Free      |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** ≥ 18
- **npm** or **yarn**
- **MongoDB** (local or Atlas account)
- **Git**

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/chat-app.git
cd chat-app
```

### 2. Set up the Backend

```bash
cd server
npm install
cp .env.example .env       # then edit .env
npm run dev
```

The server will start on **http://localhost:5000**.

### 3. Set up the Frontend

```bash
cd ../client
npm install
cp .env.example .env       # then edit .env
npm run dev
```

The app will open on **http://localhost:3000**.

### 4. Create your first account

Open the app, click **Register**, and create a user. Open a second browser (incognito), register another user, and start chatting.

---

## 📂 Project Structure

```
chat-app/
├── client/                       # React frontend
│   ├── public/
│   │   ├── locales/              # i18n translation files
│   │   └── firebase-messaging-sw.js
│   ├── src/
│   │   ├── components/           # Reusable UI components
│   │   ├── context/              # React contexts (Auth, Theme, Socket)
│   │   ├── hooks/                # Custom hooks
│   │   ├── pages/                # Route pages
│   │   ├── services/             # API service layer
│   │   ├── styles/               # Global SCSS
│   │   ├── utils/                # Helpers
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── package.json
│
├── server/                       # Node.js backend
│   ├── config/                   # DB, Socket.IO, Firebase
│   ├── controllers/              # Request handlers
│   ├── middleware/               # Auth, errors, security
│   ├── models/                   # Mongoose schemas
│   ├── routes/                   # Express routes
│   ├── utils/                    # Helpers
│   ├── server.js
│   └── package.json
│
├── README.md                     # ← this file (EN)
├── README.ar.md                  # ← Arabic version
└── LICENSE
```

---

## 🏗 Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                     Client (React + Vite)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐     │
│  │  REST API    │  │  Socket.IO   │  │  WebRTC (P2P)    │     │
│  │  (Axios)     │  │  (Real-time) │  │  (Calls)         │     │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘     │
└─────────┼─────────────────┼───────────────────┼───────────────┘
          │                 │                   │
          │ HTTP / JSON     │ WebSocket         │ UDP (SRTP)
          │                 │                   │
          ▼                 ▼                   ▼
┌───────────────────────────────────────────────────────────────┐
│                    Server (Node.js + Express)                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐     │
│  │  REST API    │  │  Socket.IO   │  │  Signaling       │     │
│  │  Controllers │  │  Handlers    │  │  (WebRTC)        │     │
│  └──────┬───────┘  └──────┬───────┘  └──────────────────┘     │
└─────────┼─────────────────┼───────────────────────────────────┘
          │                 │
          ▼                 ▼
┌───────────────────┐  ┌─────────────────┐  ┌──────────────────┐
│  MongoDB Atlas    │  │   Cloudinary    │  │  Firebase FCM    │
│  (Users, Messages,│  │   (Media CDN)   │  │  (Notifications) │
│   Conversations)  │  │                 │  │                  │
└───────────────────┘  └─────────────────┘  └──────────────────┘
```

---

## 🔑 Environment Variables

### Backend (`server/.env`)

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

### Frontend (`client/.env`)

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

## 🌐 Deployment

The app is designed to be deployed **entirely on free-tier services**.

| Component          | Service              | Cost          |
| ------------------ | -------------------- | ------------- |
| Frontend           | GitHub Pages         | Free          |
| Backend            | Render (Web Service) | Free          |
| Database           | MongoDB Atlas M0     | Free          |
| Media Storage      | Cloudinary           | Free tier     |
| Push Notifications | Firebase             | Free          |
| TURN               | Metered Open Relay   | 20 GB/mo free |
| Keep-Alive         | UptimeRobot          | Free          |

### Quick deployment steps

1. **Database** → Create a free MongoDB Atlas cluster and copy the connection string.
2. **Backend** → Push to GitHub, deploy to Render, set environment variables.
3. **Frontend** → Set `base` in `vite.config.js`, use `HashRouter`, run `npm run deploy`.
4. **TURN** → Register for Metered, add credentials to frontend `.env`.
5. **Keep-Alive** → Add UptimeRobot monitor to prevent Render cold starts.

> A detailed deployment guide is available in [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md).

---

## 🧪 Testing

```bash
# Backend
cd server
npm test

# Frontend
cd client
npm run test
```

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/amazing-feature`).
3. Commit your changes (`git commit -m 'Add amazing feature'`).
4. Push to the branch (`git push origin feature/amazing-feature`).
5. Open a Pull Request.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](./LICENSE) file for details.

---

## 👤 Author

**Your Name**

- GitHub: [@hamzaabonazzal](https://github.com/hamzaabonazzal)
- Email: hamzaabonazzal@gmail.com
- Portfolio: (https://hamzaabonazzal.github.io/Portfolio/)

---

## 🙏 Acknowledgments

- [WhatsApp](https://whatsapp.com) and [Telegram](https://telegram.org) for UX inspiration
- [Socket.IO](https://socket.io) for real-time infrastructure
- [WebRTC](https://webrtc.org) for peer-to-peer media
- The open-source community for excellent libraries

---

<div align="center">

**⭐ If you find this project useful, please give it a star!**

Made with ❤️ by [Your Name](https://github.com/YOUR_USERNAME)

</div>
