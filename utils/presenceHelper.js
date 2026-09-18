import Conversation from "../models/Conversation.js";
import Block from "../models/Block.js";

/**
 * جلب كل المستخدمين الذين شاركوا محادثة مع المستخدم المعطى.
 * يستثني المحظورين (بأي اتجاه).
 */
export const getUserContacts = async (userId) => {
  const conversations = await Conversation.find({
    participants: userId,
  }).select("participants");

  const contactsSet = new Set();
  for (const conv of conversations) {
    for (const p of conv.participants) {
      const pid = p.toString();
      if (pid !== userId.toString()) {
        contactsSet.add(pid);
      }
    }
  }

  // جلب المحظورين
  const blocks = await Block.find({
    $or: [{ blocker: userId }, { blocked: userId }],
  });

  const blockedIds = new Set();
  for (const b of blocks) {
    blockedIds.add(b.blocker.toString());
    blockedIds.add(b.blocked.toString());
  }

  // إزالة المحظورين
  return Array.from(contactsSet).filter((id) => !blockedIds.has(id));
};

/**
 * فحص وجود حظر بين مستخدمين (بأي اتجاه).
 */
export const isBlocked = async (userId1, userId2) => {
  if (userId1.toString() === userId2.toString()) return false;

  const block = await Block.findOne({
    $or: [
      { blocker: userId1, blocked: userId2 },
      { blocker: userId2, blocked: userId1 },
    ],
  });

  return !!block;
};

/**
 * فحص إذا كان مستخدم قد حظر آخر بشكل مباشر (اتجاه واحد).
 */
export const hasBlocked = async (blockerId, blockedId) => {
  const block = await Block.findOne({
    blocker: blockerId,
    blocked: blockedId,
  });
  return !!block;
};

/**
 * فحص إمكانية رؤية المستخدم لعنصر حسب الخصوصية.
 */
export const canSeeField = (targetUser, field, isContact) => {
  const privacy = targetUser.privacy?.[field] || "everyone";

  if (privacy === "everyone") return true;
  if (privacy === "nobody") return false;
  if (privacy === "contacts") return isContact;
  return true;
};

/**
 * التحقق من إمكانية رؤية الحالة (Presence).
 */
export const canSeePresence = (targetUser, viewerId, isContact) => {
  return canSeeField(targetUser, "lastSeen", isContact);
};

/**
 * بناء استجابة حالة مستخدم مع احترام الخصوصية.
 */
export const buildPresenceResponse = (targetUser, viewerId, isContact) => {
  const allowed = canSeePresence(targetUser, viewerId, isContact);

  return {
    userId: targetUser._id,
    isOnline: allowed ? targetUser.isOnline : false,
    lastSeen: allowed ? targetUser.lastSeen : null,
    presenceHidden: !allowed,
  };
};

/**
 * بناء استجابة مستخدم (للملف الشخصي) مع احترام الخصوصية.
 */
export const buildUserResponse = (targetUser, viewerId, isContact) => {
  const isSelf = targetUser._id.toString() === viewerId.toString();
  const canSeeAvatar =
    isSelf || canSeeField(targetUser, "profilePhoto", isContact);
  const canSeeBio = isSelf || canSeeField(targetUser, "about", isContact);

  return {
    _id: targetUser._id,
    username: targetUser.username,
    email: isSelf ? targetUser.email : undefined,
    avatar: canSeeAvatar ? targetUser.avatar : "",
    bio: canSeeBio ? targetUser.bio : "",
    isOnline: canSeePresence(targetUser, viewerId, isContact)
      ? targetUser.isOnline
      : false,
    lastSeen: canSeePresence(targetUser, viewerId, isContact)
      ? targetUser.lastSeen
      : null,
    createdAt: targetUser.createdAt,
    // علامات للواجهة
    avatarHidden: !canSeeAvatar,
    bioHidden: !canSeeBio,
    presenceHidden: !canSeePresence(targetUser, viewerId, isContact),
  };
};

/**
 * تحديث عدادات غير المقروءة (نُقلت هنا أيضاً للتنظيم).
 * ملاحظة: موجودة في unreadHelper.js، لكن نتركها هناك.
 */
