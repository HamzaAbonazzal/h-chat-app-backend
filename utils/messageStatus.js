/**
 * يحسب حالة الرسالة من منظور مستخدم معين.
 */
export const getMessageStatus = (message, conversation, currentUserId) => {
  // ⭐ رسائل النظام ليس لها حالة
  if (!message.sender) return null;

  const senderId = message.sender._id
    ? message.sender._id.toString()
    : message.sender.toString();

  const currentId = currentUserId.toString();

  // المستقبل لا يرى حالة الرسائل
  if (senderId !== currentId) return null;

  const recipients = conversation.participants.filter((p) => {
    const pid = p._id ? p._id.toString() : p.toString();
    return pid !== senderId;
  });

  if (recipients.length === 0) return "sent";

  const readByIds = (message.readBy || []).map((id) => id.toString());
  const deliveredToIds = (message.deliveredTo || []).map((id) => id.toString());

  const allRead = recipients.every((r) => {
    const rid = r._id ? r._id.toString() : r.toString();
    return readByIds.includes(rid);
  });
  if (allRead) return "read";

  const allDelivered = recipients.every((r) => {
    const rid = r._id ? r._id.toString() : r.toString();
    return deliveredToIds.includes(rid) || readByIds.includes(rid);
  });
  if (allDelivered) return "delivered";

  return "sent";
};
