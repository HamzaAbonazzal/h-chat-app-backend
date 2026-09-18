import mongoose from "mongoose";
import { isRedisAvailable } from "../config/redis.js";
import { isCloudinaryEnabled } from "../config/cloudinary.js";
import { isSentryEnabled } from "../config/sentry.js";

const startTime = Date.now();

/**
 * ⭐ فحص سريع (لـ Load Balancer)
 * @route GET /health
 */
export const quickHealth = (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
  });
};

/**
 * ⭐ فحص كامل (يختبر كل المكونات)
 * @route GET /health/full
 */
export const fullHealth = async (req, res) => {
  const checks = {
    server: { status: "ok" },
    database: { status: "unknown" },
    redis: { status: "unknown" },
    cloudinary: { status: "unknown" },
    sentry: { status: "unknown" },
  };

  let overallStatus = "ok";
  const startCheck = Date.now();

  // 1) MongoDB
  try {
    const dbState = mongoose.connection.readyState;
    const states = ["disconnected", "connected", "connecting", "disconnecting"];

    if (dbState === 1) {
      // ⭐ ping سريع
      await mongoose.connection.db.admin().ping();
      checks.database = {
        status: "ok",
        state: states[dbState],
        name: mongoose.connection.name,
        host: mongoose.connection.host,
      };
    } else {
      checks.database = { status: "error", state: states[dbState] };
      overallStatus = "degraded";
    }
  } catch (err) {
    checks.database = { status: "error", message: err.message };
    overallStatus = "degraded";
  }

  // 2) Redis
  if (isRedisAvailable()) {
    checks.redis = { status: "ok" };
  } else if (process.env.REDIS_URL) {
    checks.redis = { status: "error", message: "Not connected" };
    overallStatus = "degraded";
  } else {
    checks.redis = { status: "disabled" };
  }

  // 3) Cloudinary
  if (isCloudinaryEnabled()) {
    checks.cloudinary = { status: "ok" };
  } else {
    checks.cloudinary = { status: "disabled" };
  }

  // 4) Sentry
  checks.sentry = {
    status: isSentryEnabled() ? "ok" : "disabled",
  };

  // ⭐ معلومات إضافية
  const responseTime = Date.now() - startCheck;

  const httpStatus = overallStatus === "ok" ? 200 : 503;

  res.status(httpStatus).json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    environment: process.env.NODE_ENV || "development",
    version: process.env.npm_package_version || "1.0.0",
    checks,
    checkDuration: `${responseTime}ms`,
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      unit: "MB",
    },
  });
};

/**
 * ⭐ فحص جاهزية K8s
 * @route GET /health/ready
 */
export const readyHealth = async (req, res) => {
  // ⭐ جاهز فقط إذا كانت DB متصلة
  const dbReady = mongoose.connection.readyState === 1;

  if (!dbReady) {
    return res.status(503).json({
      status: "not ready",
      reason: "Database not connected",
    });
  }

  res.json({
    status: "ready",
    timestamp: new Date().toISOString(),
  });
};

/**
 * ⭐ فحص الحالة الحية
 * @route GET /health/live
 */
export const liveHealth = (req, res) => {
  // ⭐ إذا وصلنا هنا، التطبيق يعمل
  res.json({
    status: "alive",
    timestamp: new Date().toISOString(),
  });
};
