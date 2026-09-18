import Redis from "ioredis";

let redisClient = null;
let redisAvailable = false;

/**
 * تهيئة Redis
 */
export const initRedis = () => {
  if (redisClient) return redisClient;

  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    console.warn(
      "⚠️  REDIS_URL not set. Using in-memory storage (no horizontal scaling).",
    );
    return null;
  }

  try {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 5) {
          console.error("❌ Redis: max retries reached");
          return null; // توقف عن إعادة المحاولة
        }
        return Math.min(times * 200, 2000);
      },
      // ⭐ Upstash يحتاج هذه الإعدادات
      enableReadyCheck: true,
      lazyConnect: false,
      // ⭐ إظهار معلومات أقل في Console
      showFriendlyErrorStack: process.env.NODE_ENV === "development",
    });

    redisClient.on("connect", () => {
      console.log("✅ Redis: connecting...");
    });

    redisClient.on("ready", () => {
      console.log("✅ Redis: ready");
      redisAvailable = true;
    });

    redisClient.on("error", (err) => {
      console.error("❌ Redis error:", err.message);
      redisAvailable = false;
    });

    redisClient.on("close", () => {
      console.warn("⚠️  Redis: connection closed");
      redisAvailable = false;
    });

    redisClient.on("reconnecting", () => {
      console.log("🔄 Redis: reconnecting...");
    });

    return redisClient;
  } catch (err) {
    console.error("❌ Failed to initialize Redis:", err.message);
    return null;
  }
};

/**
 * هل Redis متاح؟
 */
export const isRedisAvailable = () => redisAvailable && redisClient !== null;

/**
 * الحصول على Redis Client
 */
export const getRedisClient = () => redisClient;

/**
 * إغلاق Redis
 */
export const closeRedis = async () => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    redisAvailable = false;
    console.log("👋 Redis: closed");
  }
};

// ⭐ دوال مساعدة للاستخدام العام

/**
 * تعيين قيمة (مع TTL اختياري بالثواني)
 */
export const redisSet = async (key, value, ttl = null) => {
  if (!isRedisAvailable()) return false;
  try {
    const stringValue = JSON.stringify(value);
    if (ttl) {
      await redisClient.set(key, stringValue, "EX", ttl);
    } else {
      await redisClient.set(key, stringValue);
    }
    return true;
  } catch (err) {
    console.error("Redis SET error:", err.message);
    return false;
  }
};

/**
 * قراءة قيمة
 */
export const redisGet = async (key) => {
  if (!isRedisAvailable()) return null;
  try {
    const value = await redisClient.get(key);
    return value ? JSON.parse(value) : null;
  } catch (err) {
    console.error("Redis GET error:", err.message);
    return null;
  }
};

/**
 * حذف مفتاح
 */
export const redisDel = async (key) => {
  if (!isRedisAvailable()) return false;
  try {
    await redisClient.del(key);
    return true;
  } catch (err) {
    console.error("Redis DEL error:", err.message);
    return false;
  }
};

/**
 * زيادة قيمة (عداد)
 */
export const redisIncr = async (key) => {
  if (!isRedisAvailable()) return 0;
  try {
    return await redisClient.incr(key);
  } catch (err) {
    console.error("Redis INCR error:", err.message);
    return 0;
  }
};

/**
 * انتهاء صلاحية
 */
export const redisExpire = async (key, ttl) => {
  if (!isRedisAvailable()) return false;
  try {
    await redisClient.expire(key, ttl);
    return true;
  } catch (err) {
    console.error("Redis EXPIRE error:", err.message);
    return false;
  }
};

export default {
  initRedis,
  isRedisAvailable,
  getRedisClient,
  closeRedis,
  redisSet,
  redisGet,
  redisDel,
  redisIncr,
  redisExpire,
};
