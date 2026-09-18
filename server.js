import "dotenv/config";
import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import hpp from "hpp";
import path from "path";
import { fileURLToPath } from "url";

import { connectDB } from "./config/db.js";
import { initSocket } from "./config/socket.js";
import { initFirebase } from "./config/firebase.js";
import { initCloudinary } from "./config/cloudinary.js";
import {
  initSentry,
  sentryRequestHandler,
  sentryErrorHandler,
} from "./config/sentry.js";
import logger from "./utils/logger.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { notFound, errorHandler } from "./middleware/errorMiddleware.js";
import { generalLimiter } from "./middleware/rateLimiters.js";
import {
  noSQLSanitizer,
  xssSanitizer,
} from "./middleware/sanitizeMiddleware.js";

import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import conversationRoutes from "./routes/conversationRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import blockRoutes from "./routes/blockRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import linkPreviewRoutes from "./routes/linkPreviewRoutes.js";
import callRoutes from "./routes/callRoutes.js";
import iceRoutes from "./routes/iceRoutes.js";
import healthRoutes from "./routes/healthRoutes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============ CORS: قائمة النطاقات المسموحة ============

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:5173", // Vite
  process.env.CLIENT_URL,
].filter(Boolean);

// ============ Start Server ============

const startServer = async () => {
  try {
    // ⭐ الاتصال بقاعدة البيانات أولاً
    await connectDB();

    // ⭐ تهيئة Firebase
    initFirebase();

    // ⭐ تهيئة Cloudinary
    initCloudinary();

    // ============ Express App ============

    const app = express();
    const server = http.createServer(app);

    // ⭐ trust proxy (ضروري على Render لتحديد IP الحقيقي)
    app.set("trust proxy", 1);

    // ⭐ تهيئة Sentry (قبل أي middleware)
    initSentry(app);

    // ⭐ Sentry Request Handler (أول middleware)
    app.use(sentryRequestHandler());

    // ⭐ Timeouts متوافقة مع Render
    server.timeout = 120000;
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;

    // ============ Socket.IO ============

    const io = new Server(server, {
      cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"],
        credentials: true,
      },
      transports: ["websocket", "polling"],
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    initSocket(io);
    app.set("io", io);

    // ============ Logging ============

    if (process.env.NODE_ENV === "development") {
      app.use(morgan("dev"));
    } else {
      app.use(
        morgan("combined", {
          stream: logger.stream,
          skip: (req) =>
            req.path === "/health" || req.path.startsWith("/health/"),
        }),
      );
    }

    // ⭐ Request Logger
    app.use(requestLogger);

    // ============ Security ============

    app.use(helmet({ crossOriginResourcePolicy: false }));

    // ⭐ CORS مع دالة origin
    app.use(
      cors({
        origin: (origin, callback) => {
          if (!origin) return callback(null, true);
          if (allowedOrigins.includes(origin)) return callback(null, true);
          return callback(new Error(`CORS blocked: ${origin}`));
        },
        credentials: true,
      }),
    );

    app.use(express.json({ limit: "10mb" }));
    app.use(express.urlencoded({ extended: true, limit: "10mb" }));
    app.use(cookieParser());

    app.use(noSQLSanitizer);
    app.use(xssSanitizer);
    app.use(hpp());

    // ⭐ Rate Limiter على /api فقط
    app.use("/api", generalLimiter);

    // ============ Static ============

    app.use("/uploads", express.static(path.join(__dirname, "uploads")));

    // ============ Routes ============

    // ⭐ Health Checks — بدون /api
    app.use("/health", healthRoutes);

    app.get("/", (req, res) =>
      res.json({
        success: true,
        message: "API is running...",
        version:
          process.env.npm_package_version || process.env.APP_VERSION || "1.0.0",
        environment: process.env.NODE_ENV || "development",
      }),
    );

    app.use("/api/auth", authRoutes);
    app.use("/api/users", userRoutes);
    app.use("/api/conversations", conversationRoutes);
    app.use("/api/messages", messageRoutes);
    app.use("/api/upload", uploadRoutes);
    app.use("/api/blocks", blockRoutes);
    app.use("/api/notifications", notificationRoutes);
    app.use("/api/link-preview", linkPreviewRoutes);
    app.use("/api/calls", callRoutes);
    app.use("/api/ice-servers", iceRoutes);

    // ============ Error Handling ============

    app.use(sentryErrorHandler());
    app.use(notFound);
    app.use(errorHandler);

    // ============ Listen ============

    const PORT = process.env.PORT || 5000;

    server.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📦 Environment: ${process.env.NODE_ENV || "development"}`);
      logger.info(`🌐 Allowed Origins: ${allowedOrigins.join(", ")}`);
    });

    // ============ Graceful Shutdown ============

    const gracefulShutdown = async (signal) => {
      logger.info(`${signal} received. Shutting down gracefully...`);

      server.close(async () => {
        logger.info("✅ HTTP server closed");

        try {
          const mongoose = (await import("mongoose")).default;
          await mongoose.connection.close();
          logger.info("✅ MongoDB connection closed");

          logger.info("👋 Goodbye!");
          process.exit(0);
        } catch (err) {
          logger.error("Error during shutdown:", err);
          process.exit(1);
        }
      });

      // ⭐ إجبار الإغلاق بعد 30 ثانية
      setTimeout(() => {
        logger.error("Forced shutdown after timeout");
        process.exit(1);
      }, 30000);
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));

    // ============ Global Error Handlers ============

    process.on("unhandledRejection", (reason, promise) => {
      logger.error("Unhandled Rejection:", {
        reason: reason?.message || reason,
        stack: reason?.stack,
      });
    });

    process.on("uncaughtException", (error) => {
      logger.error("Uncaught Exception:", {
        message: error.message,
        stack: error.stack,
      });
      process.exit(1);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err);
    console.error(err.stack);
    process.exit(1);
  }
};

startServer();
