import { getFirebaseMessaging } from "../config/firebase.js";
import User from "../models/User.js";

/**
 * إرسال إشعار لجهاز أو أكثر.
 */
export const sendPushNotification = async ({
  tokens,
  title,
  body,
  data = {},
  imageUrl = null,
}) => {
  const messaging = getFirebaseMessaging();
  if (!messaging) {
    return { successCount: 0, failureCount: tokens.length, invalidTokens: [] };
  }

  if (!tokens || tokens.length === 0) {
    return { successCount: 0, failureCount: 0, invalidTokens: [] };
  }

  const stringifiedData = {};
  for (const [key, value] of Object.entries(data)) {
    stringifiedData[key] = String(value);
  }

  // ⭐ نضع title و body داخل data أيضاً (للـ foreground)
  stringifiedData.title = String(title || "رسالة جديدة");
  stringifiedData.body = String(body || "");

  // ⭐ إذا كانت مكالمة → إشعار ذو أولوية عالية + tag مميز
  const isCall = stringifiedData.type === "incoming_call";

  const message = {
    tokens,
    notification: {
      title: title || "رسالة جديدة",
      body: body || "",
      ...(imageUrl && { imageUrl }),
    },
    data: stringifiedData,
    webpush: {
      headers: {
        Urgency: "high", // ⭐ عالي الأهمية
        ...(isCall && { TTL: "30" }), // ⭐ ينتهي بعد 30 ثانية للمكالمات
      },
      notification: {
        title: title || "رسالة جديدة",
        body: body || "",
        icon: "/icon-192.png",
        badge: "/badge-72.png",
        tag: isCall
          ? "incoming_call"
          : stringifiedData.conversationId || "default",
        renotify: isCall, // ⭐ يُعيد التنبيه للمكالمات
        requireInteraction: isCall, // ⭐ يبقى حتى يتفاعل المستخدم (للمكالمات)
        ...(imageUrl && { image: imageUrl }),
      },
      fcmOptions: {
        link: isCall
          ? `/incoming-call?callId=${stringifiedData.callId}`
          : stringifiedData.link || "/",
      },
    },
  };

  try {
    const response = await messaging.sendEachForMulticast(message);

    const invalidTokens = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        const code = resp.error?.code;
        if (
          code === "messaging/invalid-registration-token" ||
          code === "messaging/registration-token-not-registered"
        ) {
          invalidTokens.push(tokens[idx]);
        }
      }
    });

    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
      invalidTokens,
    };
  } catch (err) {
    console.error("❌ FCM send error:", err.message);
    return {
      successCount: 0,
      failureCount: tokens.length,
      invalidTokens: [],
    };
  }
};

export const sendNotificationToUser = async (
  userId,
  { title, body, data = {}, imageUrl },
) => {
  const user = await User.findById(userId).select("fcmTokens");
  if (!user || user.fcmTokens.length === 0) return null;

  const tokens = user.fcmTokens.map((t) => t.token);

  const result = await sendPushNotification({
    tokens,
    title,
    body,
    data,
    imageUrl,
  });

  if (result.invalidTokens.length > 0) {
    await User.findByIdAndUpdate(userId, {
      $pull: { fcmTokens: { token: { $in: result.invalidTokens } } },
    });
  }

  return result;
};

export const sendNotificationToUsers = async (
  userIds,
  { title, body, data = {}, imageUrl },
) => {
  const results = await Promise.all(
    userIds.map((id) =>
      sendNotificationToUser(id, { title, body, data, imageUrl }),
    ),
  );
  return results;
};
