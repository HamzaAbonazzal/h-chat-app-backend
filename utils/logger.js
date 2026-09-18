import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ⭐ مجلد السجلات
const logsDir = path.join(__dirname, "..", "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// ⭐ بيئة التشغيل
const isProduction = process.env.NODE_ENV === "production";
const logLevel = process.env.LOG_LEVEL || (isProduction ? "info" : "debug");

// ⭐ تنسيقات مخصصة
const { combine, timestamp, printf, colorize, errors, json, splat } =
  winston.format;

// ⭐ تنسيق Console (مقرؤ للبشر)
const consoleFormat = printf(
  ({ level, message, timestamp, stack, ...meta }) => {
    const metaStr =
      Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta, null, 0)}` : "";
    return `${timestamp} [${level}]: ${stack || message}${metaStr}`;
  },
);

// ⭐ تنسيق الملف (JSON — للتحليل الآلي)
const fileFormat = combine(
  timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  errors({ stack: true }),
  splat(),
  json(),
);

// ⭐ Transports
const transports = [];

// 1) Console
transports.push(
  new winston.transports.Console({
    format: combine(
      colorize({ all: true }),
      timestamp({ format: "HH:mm:ss" }),
      errors({ stack: true }),
      splat(),
      consoleFormat,
    ),
    level: logLevel,
  }),
);

// 2) ملف الأخطاء فقط
transports.push(
  new DailyRotateFile({
    filename: path.join(logsDir, "error-%DATE%.log"),
    datePattern: "YYYY-MM-DD",
    level: "error",
    format: fileFormat,
    maxSize: "20m",
    maxFiles: "14d", // احتفظ لمدة 14 يوم
    zippedArchive: true,
  }),
);

// 3) ملف كل السجلات
transports.push(
  new DailyRotateFile({
    filename: path.join(logsDir, "combined-%DATE%.log"),
    datePattern: "YYYY-MM-DD",
    format: fileFormat,
    maxSize: "20m",
    maxFiles: "14d",
    zippedArchive: true,
  }),
);

// 4) ملف منفصل للمكالمات (اختياري)
transports.push(
  new DailyRotateFile({
    filename: path.join(logsDir, "calls-%DATE%.log"),
    datePattern: "YYYY-MM-DD",
    format: fileFormat,
    maxSize: "20m",
    maxFiles: "30d",
    zippedArchive: true,
    // ⭐ فلتر: فقط الأحداث المتعلقة بالمكالمات
    filter: (log) =>
      log.category === "call" ||
      (log.message && log.message.toLowerCase().includes("call")),
  }),
);

// ⭐ إنشاء Logger رئيسي
const logger = winston.createLogger({
  level: logLevel,
  format: combine(
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    errors({ stack: true }),
    splat(),
  ),
  transports,
  // ⭐ لا يُوقف التطبيق عند خطأ في logging
  exitOnError: false,
});

// ⭐ Stream لاستخدامه مع Morgan
logger.stream = {
  write: (message) => {
    logger.info(message.trim(), { category: "http" });
  },
};

// ⭐ دوال مساعدة
logger.logRequest = (req, res, responseTime) => {
  const meta = {
    category: "http",
    method: req.method,
    url: req.originalUrl,
    status: res.statusCode,
    responseTime: `${responseTime}ms`,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get("user-agent"),
    userId: req.user?._id?.toString() || null,
  };

  // ⭐ تحديد المستوى حسب رمز الحالة
  if (res.statusCode >= 500) {
    logger.error(`${req.method} ${req.originalUrl} - ${res.statusCode}`, meta);
  } else if (res.statusCode >= 400) {
    logger.warn(`${req.method} ${req.originalUrl} - ${res.statusCode}`, meta);
  } else {
    logger.info(`${req.method} ${req.originalUrl} - ${res.statusCode}`, meta);
  }
};

logger.logError = (error, req = null) => {
  const meta = {
    category: "error",
    name: error.name,
    message: error.message,
    statusCode: error.statusCode,
    code: error.code,
    stack: error.stack,
  };

  if (req) {
    meta.method = req.method;
    meta.url = req.originalUrl;
    meta.ip = req.ip;
    meta.userId = req.user?._id?.toString() || null;
  }

  logger.error(error.message, meta);
};

logger.logCall = (event, data) => {
  logger.info(`Call: ${event}`, {
    category: "call",
    ...data,
    timestamp: new Date().toISOString(),
  });
};

logger.logAuth = (event, data) => {
  logger.info(`Auth: ${event}`, {
    category: "auth",
    ...data,
  });
};

logger.logSocket = (event, data) => {
  logger.debug(`Socket: ${event}`, {
    category: "socket",
    ...data,
  });
};

export default logger;
export { logger };
