import logger from "../utils/logger.js";

/**
 * Middleware لتسجيل كل طلب HTTP مع وقت الاستجابة
 */
export const requestLogger = (req, res, next) => {
  const startTime = Date.now();

  // ⭐ تسجيل عند انتهاء الاستجابة
  res.on("finish", () => {
    const responseTime = Date.now() - startTime;
    logger.logRequest(req, res, responseTime);
  });

  // ⭐ تسجيل الأخطاء
  res.on("error", (err) => {
    logger.logError(err, req);
  });

  next();
};

/**
 * Middleware لتسجيل Socket Events (اختياري)
 */
export const socketLogger = (socket, event, data) => {
  logger.logSocket(event, {
    socketId: socket.id,
    userId: socket.userId,
    ...data,
  });
};
