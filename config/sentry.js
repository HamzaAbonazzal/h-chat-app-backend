import * as Sentry from "@sentry/node";

let sentryInitialized = false;

/**
 * تهيئة Sentry (اختياري)
 */
export const initSentry = (app) => {
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    console.log("⚠️  Sentry: DSN not set. Error tracking disabled.");
    return false;
  }

  try {
    Sentry.init({
      dsn,
      environment: process.env.SENTRY_ENVIRONMENT || "development",
      tracesSampleRate: parseFloat(
        process.env.SENTRY_TRACES_SAMPLE_RATE || "0.1",
      ),
      // ⭐ لا تُرسل البيانات الحساسة
      beforeSend(event) {
        // احذف كلمات المرور من الطلبات
        if (event.request?.data?.password) {
          delete event.request.data.password;
        }
        if (event.request?.data?.currentPassword) {
          delete event.request.data.currentPassword;
        }
        if (event.request?.data?.newPassword) {
          delete event.request.data.newPassword;
        }
        // احذف التوكنات
        if (event.request?.headers?.authorization) {
          event.request.headers.authorization = "[REDACTED]";
        }
        if (event.request?.headers?.cookie) {
          event.request.headers.cookie = "[REDACTED]";
        }
        return event;
      },
      ignoreErrors: [
        // ⭐ أخطاء متوقعة — لا نحتاج إشعاراً بها
        "Network Error",
        "NetworkError",
        "timeout",
        "ECONNABORTED",
        "Request failed with status code 401",
      ],
    });

    sentryInitialized = true;
    console.log("✅ Sentry initialized");
    return true;
  } catch (err) {
    console.error("❌ Sentry init failed:", err.message);
    return false;
  }
};

/**
 * Middleware Sentry — يجب أن يكون أول middleware
 */
export const sentryRequestHandler = () => {
  if (!sentryInitialized) return (req, res, next) => next();
  return Sentry.Handlers.requestHandler();
};

/**
 * Middleware Sentry للأخطاء — قبل custom error handler
 */
export const sentryErrorHandler = () => {
  if (!sentryInitialized) return (err, req, res, next) => next(err);
  return Sentry.Handlers.errorHandler({
    shouldHandleError(error) {
      // ⭐ أرسل فقط أخطاء 500+
      if (error.statusCode && error.statusCode < 500) return false;
      return true;
    },
  });
};

/**
 * إضافة معلومات المستخدم للـ Sentry
 */
export const setSentryUser = (user) => {
  if (!sentryInitialized || !user) return;
  Sentry.setUser({
    id: user._id?.toString(),
    username: user.username,
  });
};

/**
 * تسجيل خطأ يدوياً في Sentry
 */
export const captureException = (error, context = {}) => {
  if (!sentryInitialized) return;
  Sentry.captureException(error, { extra: context });
};

export const isSentryEnabled = () => sentryInitialized;
