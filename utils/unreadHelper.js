import Conversation from "../models/Conversation.js";

/**
 * يزيد عداد غير المقروءة لكل المستقبلين (عدا المُرسل).
 * يعيد Map بالعدادات الجديدة لكل مستقبل.
 */
export const incrementUnreadCounts = async (conversation, senderId) => {
  const senderStr = senderId.toString();
  const incrementOps = {};
  const recipients = [];

  for (const participant of conversation.participants) {
    const pid = participant._id
      ? participant._id.toString()
      : participant.toString();

    if (pid === senderStr) continue;

    incrementOps[`unreadCounts.${pid}`] = 1;
    recipients.push(pid);
  }

  if (recipients.length === 0) return {};

  const updated = await Conversation.findByIdAndUpdate(
    conversation._id,
    { $inc: incrementOps },
    { new: true },
  );

  // استخراج القيم الجديدة لكل مستقبل
  const result = {};
  for (const pid of recipients) {
    result[pid] = updated.unreadCounts?.get(pid) || 0;
  }
  return result;
};

/**
 * يصفّر عداد مستخدم معين في محادثة.
 */
export const resetUnreadCount = async (conversationId, userId) => {
  await Conversation.findByIdAndUpdate(conversationId, {
    $set: { [`unreadCounts.${userId.toString()}`]: 0 },
  });
};

/**
 * يستخرج العداد الحالي لمستخدم من كائن محادثة.
 */
export const getUnreadCount = (conversation, userId) => {
  if (!conversation.unreadCounts) return 0;

  // Map
  if (typeof conversation.unreadCounts.get === "function") {
    return conversation.unreadCounts.get(userId.toString()) || 0;
  }

  // Plain object (بعد toObject)
  return conversation.unreadCounts[userId.toString()] || 0;
};
