import { ApiError } from "../utils/ApiError.js";
import logger from "../utils/logger.js";
import { captureException, isSentryEnabled } from "../config/sentry.js";

export const notFound = (req, res, next) => {
  next(new ApiError(404, `Route not found: ${req.originalUrl}`));
};

export const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";
  let code = err.code || null;

  // ⭐ خطأ Mongoose: ID غير صالح
  if (err.name === "CastError" && err.kind === "ObjectId") {
    statusCode = 404;
    message = "Resource not found";
    code = "RESOURCE_NOT_FOUND";
  }

  // ⭐ خطأ Mongoose: حقل مكرر
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue)[0];
    message = `Duplicate value for ${field}`;
    code = "DUPLICATE_VALUE";
  }

  // ⭐ خطأ التحقق من Mongoose
  if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(", ");
    code = "VALIDATION_ERROR";
  }

  // ⭐ خطأ JWT
  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token";
    code = "INVALID_TOKEN";
  }

  // ⭐ خطأ Multer (رفع الملفات)
  if (err.name === "MulterError") {
    statusCode = 400;
    if (err.code === "LIMIT_FILE_SIZE") {
      message = "File too large (max 100MB)";
      code = "FILE_TOO_LARGE";
    } else {
      message = `Upload error: ${err.message}`;
      code = "UPLOAD_ERROR";
    }
  }

  // ⭐ تسجيل الخطأ
  logger.logError({ ...err, statusCode, message, code }, req);

  // ⭐ إرسال إلى Sentry (فقط أخطاء 500+)
  if (isSentryEnabled() && statusCode >= 500) {
    captureException(err, {
      method: req.method,
      url: req.originalUrl,
      userId: req.user?._id?.toString(),
    });
  }

  // ⭐ الرد
  res.status(statusCode).json({
    success: false,
    message,
    ...(code && { code }),
    ...(process.env.NODE_ENV === "development" && {
      stack: err.stack,
    }),
  });
};
