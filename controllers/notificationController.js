import User from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendPushNotification } from "../utils/notificationService.js";

// @route POST /api/notifications/register-token
// Body: { token, device }
export const registerToken = asyncHandler(async (req, res) => {
  const { token, device = "web" } = req.body;

  if (!token) throw new ApiError(400, "Token is required");

  const user = await User.findById(req.user._id);

  // ⭐ فحص إذا كان التوكن موجوداً (لتجنب التكرار)
  const exists = user.fcmTokens.some((t) => t.token === token);

  if (!exists) {
    user.fcmTokens.push({ token, device, addedAt: new Date() });

    // ⭐ احتفظ بحد أقصى 5 أجهزة لكل مستخدم
    if (user.fcmTokens.length > 5) {
      user.fcmTokens = user.fcmTokens.slice(-5);
    }

    await user.save();
  }

  res.json({ success: true, message: "Token registered" });
});

// @route DELETE /api/notifications/unregister-token
// Body: { token }
export const unregisterToken = asyncHandler(async (req, res) => {
  const { token } = req.body;
  if (!token) throw new ApiError(400, "Token is required");

  await User.findByIdAndUpdate(req.user._id, {
    $pull: { fcmTokens: { token } },
  });

  res.json({ success: true, message: "Token unregistered" });
});

// @route POST /api/notifications/test
// ⭐ لإرسال إشعار تجريبي — لأغراض الاختبار
export const sendTestNotification = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select("fcmTokens");
  if (!user || user.fcmTokens.length === 0) {
    throw new ApiError(400, "No FCM tokens registered for this user");
  }

  const tokens = user.fcmTokens.map((t) => t.token);

  const result = await sendPushNotification({
    tokens,
    title: "اختبار الإشعارات 🔔",
    body: "هذا إشعار تجريبي من تطبيق المحادثة",
    data: {
      type: "test",
      link: "/",
    },
  });

  res.json({
    success: true,
    data: result,
  });
});
