import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import { getRedisClient, isRedisAvailable } from "../config/redis.js";

/**
 * ⭐ إنشاء Redis Store إذا كان Redis متاحاً
 * — وإلا يعود إلى In-Memory Store (افتراضي)
 */
const createStore = (prefix) => {
  if (!isRedisAvailable()) return undefined;

  const client = getRedisClient();
  if (!client) return undefined;

  try {
    return new RedisStore({
      sendCommand: (...args) => client.call(...args),
      prefix: `rl:${prefix}:`,
    });
  } catch (err) {
    console.warn(
      `⚠️  Failed to create Redis store for "${prefix}", falling back to memory:`,
      err.message,
    );
    return undefined;
  }
};

/**
 * ⭐ الحد العام: 300 طلب كل 15 دقيقة لكل IP.
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: {
    success: false,
    message: "Too many requests, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore("general"),
});

/**
 * ⭐ حد صارم للمصادقة: 10 محاولات كل 15 دقيقة.
 * يمنع Brute Force على تسجيل الدخول.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: "Too many login attempts, please try again after 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  store: createStore("auth"),
});

/**
 * ⭐ حد إرسال الرسائل: 60 رسالة كل دقيقة.
 */
export const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: {
    success: false,
    message: "You are sending messages too quickly. Please slow down.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore("message"),
});

/**
 * ⭐ حد رفع الملفات: 20 ملف كل ساعة.
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    message: "Upload limit reached. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore("upload"),
});

/**
 * ⭐ حد إنشاء الحسابات: 5 حسابات كل ساعة لكل IP.
 */
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: "Too many accounts created from this IP. Try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore("register"),
});

/**
 * ⭐ حد جلب معاينة الروابط: 30 طلب كل دقيقة.
 */
export const linkPreviewLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: {
    success: false,
    message: "Too many preview requests, please slow down.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore("link-preview"),
});
