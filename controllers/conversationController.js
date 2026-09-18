import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getUnreadCount } from "../utils/unreadHelper.js";
import { isBlocked } from "../utils/presenceHelper.js";

// ⭐ helper: إنشاء رسالة نظام
const createSystemMessage = async (
  conversationId,
  action,
  actorId,
  targetId = null,
  metadata = {},
) => {
  const msg = await Message.create({
    conversation: conversationId,
    sender: null,
    type: "system",
    content: "",
    systemMessage: {
      action,
      actor: actorId,
      target: targetId,
      metadata,
    },
  });

  await Conversation.findByIdAndUpdate(conversationId, {
    lastMessage: msg._id,
  });

  return msg;
};

// ⭐ helper: populate الرسالة النظامية للبث
const populateSystemMessage = async (msg) => {
  return await msg.populate([
    { path: "systemMessage.actor", select: "username avatar" },
    { path: "systemMessage.target", select: "username avatar" },
  ]);
};

// ⭐ helper: بناء معلومات التثبيت/الكتم/الأرشفة لمستخدم معين
const buildUserFlags = (conversation, userId) => {
  const uid = userId.toString();

  const isPinned = (conversation.pinnedBy || []).some(
    (id) => id.toString() === uid,
  );
  const isArchived = (conversation.archivedBy || []).some(
    (id) => id.toString() === uid,
  );

  // ⭐ فحص الكتم (مع التحقق من انتهاء المدة)
  const muteEntry = (conversation.mutedBy || []).find(
    (m) => m.user.toString() === uid,
  );
  let isMuted = false;
  let muteUntil = null;

  if (muteEntry) {
    if (!muteEntry.until) {
      // كتم دائم
      isMuted = true;
      muteUntil = null;
    } else if (new Date(muteEntry.until) > new Date()) {
      // لا يزال ساري
      isMuted = true;
      muteUntil = muteEntry.until;
    }
    // إذا انتهت المدة — isMuted يبقى false
  }

  return { isPinned, isMuted, isArchived, muteUntil };
};

// @route POST /api/conversations
export const createOrGetConversation = asyncHandler(async (req, res) => {
  const { userId, userIds, name, isGroup } = req.body;

  if (!isGroup) {
    if (!userId) throw new ApiError(400, "userId is required");

    const blocked = await isBlocked(req.user._id, userId);
    if (blocked) {
      throw new ApiError(
        403,
        "You cannot start a conversation with this user",
        "CONVERSATION_BLOCKED",
      );
    }

    let conversation = await Conversation.findOne({
      isGroup: false,
      participants: { $all: [req.user._id, userId], $size: 2 },
    })
      .populate("participants", "-password -refreshToken -privacy")
      .populate("lastMessage");

    if (conversation) {
      if (
        conversation.deletedFor.some(
          (id) => id.toString() === req.user._id.toString(),
        )
      ) {
        conversation.deletedFor = conversation.deletedFor.filter(
          (id) => id.toString() !== req.user._id.toString(),
        );
        await conversation.save();
      }
      return res.json({ success: true, data: conversation });
    }

    conversation = await Conversation.create({
      isGroup: false,
      participants: [req.user._id, userId],
    });

    conversation = await conversation.populate(
      "participants",
      "-password -refreshToken -privacy",
    );
    return res.status(201).json({ success: true, data: conversation });
  }

  if (!userIds || userIds.length < 1) {
    throw new ApiError(400, "Group needs at least 1 other participant");
  }
  if (!name || !name.trim()) {
    throw new ApiError(400, "Group name is required");
  }

  const allParticipants = [...new Set([...userIds, req.user._id.toString()])];

  const group = await Conversation.create({
    isGroup: true,
    name: name.trim(),
    participants: allParticipants,
    admins: [req.user._id],
    owner: req.user._id,
  });

  const sysMsg = await createSystemMessage(
    group._id,
    "group_created",
    req.user._id,
  );

  const populated = await group.populate(
    "participants",
    "-password -refreshToken -privacy",
  );

  const populatedSysMsg = await populateSystemMessage(sysMsg);

  const io = req.app.get("io");
  if (io) {
    io.to(group._id.toString()).emit("newMessage", populatedSysMsg);
    io.to(req.user._id.toString()).emit("newMessage", populatedSysMsg);
  }

  res.status(201).json({
    success: true,
    data: populated,
    systemMessage: populatedSysMsg,
  });
});

// @route GET /api/conversations
export const getUserConversations = asyncHandler(async (req, res) => {
  const conversations = await Conversation.find({
    participants: req.user._id,
    deletedFor: { $ne: req.user._id },
  })
    .populate("participants", "-password -refreshToken -privacy")
    .populate({
      path: "lastMessage",
      populate: [
        { path: "sender", select: "username avatar" },
        { path: "systemMessage.actor", select: "username avatar" },
        { path: "systemMessage.target", select: "username avatar" },
      ],
    });

  const formatted = conversations.map((conv) => {
    const obj = conv.toObject();
    const flags = buildUserFlags(obj, req.user._id);
    return {
      ...obj,
      unreadCount: getUnreadCount(obj, req.user._id),
      ...flags,
    };
  });

  // ⭐ الفرز: المثبتة أولاً، ثم الأحدث
  formatted.sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });

  res.json({ success: true, data: formatted });
});

// @route GET /api/conversations/:id
export const getConversationById = asyncHandler(async (req, res) => {
  const conversation = await Conversation.findById(req.params.id)
    .populate("participants", "-password -refreshToken -privacy")
    .populate("admins", "-password -refreshToken -privacy")
    .populate("owner", "-password -refreshToken -privacy");

  if (!conversation) throw new ApiError(404, "Conversation not found");

  const isMember = conversation.participants.some(
    (p) => p._id.toString() === req.user._id.toString(),
  );
  if (!isMember) throw new ApiError(403, "Not a participant");

  const obj = conversation.toObject();
  const flags = buildUserFlags(obj, req.user._id);

  res.json({
    success: true,
    data: {
      ...obj,
      unreadCount: getUnreadCount(obj, req.user._id),
      ...flags,
    },
  });
});

// @route PUT /api/conversations/:id
export const updateGroup = asyncHandler(async (req, res) => {
  const { name, groupAvatar, description } = req.body;
  const conversation = await Conversation.findById(req.params.id);

  if (!conversation || !conversation.isGroup)
    throw new ApiError(404, "Group not found");

  const userId = req.user._id;
  const isAdmin = conversation.admins.some(
    (a) => a.toString() === userId.toString(),
  );

  if (conversation.permissions.editGroupInfo === "admins" && !isAdmin) {
    throw new ApiError(403, "Only admins can edit group info");
  }

  const changes = {};
  if (name && name.trim() && name.trim() !== conversation.name) {
    changes.name = conversation.name;
    conversation.name = name.trim();
  }
  if (groupAvatar && groupAvatar !== conversation.groupAvatar) {
    changes.groupAvatar = conversation.groupAvatar;
    conversation.groupAvatar = groupAvatar;
  }
  if (description !== undefined && description !== conversation.description) {
    changes.description = conversation.description;
    conversation.description = description;
  }

  await conversation.save();

  const io = req.app.get("io");

  if (name && name.trim() !== changes.name) {
    const sysMsg = await createSystemMessage(
      conversation._id,
      "group_name_changed",
      userId,
      null,
      { newName: name.trim(), oldName: changes.name },
    );
    const populated = await populateSystemMessage(sysMsg);
    if (io) io.to(conversation._id.toString()).emit("newMessage", populated);
  }

  if (groupAvatar && groupAvatar !== changes.groupAvatar) {
    const sysMsg = await createSystemMessage(
      conversation._id,
      "group_photo_changed",
      userId,
    );
    const populated = await populateSystemMessage(sysMsg);
    if (io) io.to(conversation._id.toString()).emit("newMessage", populated);
  }

  if (description !== undefined && description !== changes.description) {
    const sysMsg = await createSystemMessage(
      conversation._id,
      "group_description_changed",
      userId,
    );
    const populated = await populateSystemMessage(sysMsg);
    if (io) io.to(conversation._id.toString()).emit("newMessage", populated);
  }

  const updated = await Conversation.findById(conversation._id)
    .populate("participants", "-password -refreshToken -privacy")
    .populate("admins", "-password -refreshToken -privacy")
    .populate("owner", "-password -refreshToken -privacy");

  res.json({ success: true, data: updated });
});

// @route POST /api/conversations/:id/participants
export const addParticipant = asyncHandler(async (req, res) => {
  const { userId } = req.body;
  const conversation = await Conversation.findById(req.params.id);

  if (!conversation || !conversation.isGroup)
    throw new ApiError(404, "Group not found");

  const userIdMe = req.user._id;
  const isAdmin = conversation.admins.some(
    (a) => a.toString() === userIdMe.toString(),
  );

  if (conversation.permissions.addMembers === "admins" && !isAdmin) {
    throw new ApiError(403, "Only admins can add members");
  }

  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  const blocked = await isBlocked(userIdMe, userId);
  if (blocked) {
    throw new ApiError(403, "You cannot add a blocked user");
  }

  const alreadyMember = conversation.participants.some(
    (p) => p.toString() === userId.toString(),
  );
  if (alreadyMember) {
    throw new ApiError(400, "User is already a member");
  }

  conversation.participants.push(userId);
  conversation.deletedFor = conversation.deletedFor.filter(
    (id) => id.toString() !== userId.toString(),
  );
  await conversation.save();

  const sysMsg = await createSystemMessage(
    conversation._id,
    "user_added",
    userIdMe,
    userId,
  );
  const populatedMsg = await populateSystemMessage(sysMsg);

  const io = req.app.get("io");
  if (io) {
    io.to(conversation._id.toString()).emit("newMessage", populatedMsg);
  }

  const populated = await conversation.populate(
    "participants",
    "-password -refreshToken -privacy",
  );
  res.json({ success: true, data: populated });
});

// @route DELETE /api/conversations/:id/participants/:userId
export const removeParticipant = asyncHandler(async (req, res) => {
  const { id, userId } = req.params;
  const conversation = await Conversation.findById(id);

  if (!conversation || !conversation.isGroup)
    throw new ApiError(404, "Group not found");

  const userIdMe = req.user._id;
  const isSelf = userId === userIdMe.toString();
  const isAdmin = conversation.admins.some(
    (a) => a.toString() === userIdMe.toString(),
  );

  if (
    conversation.owner &&
    conversation.owner.toString() === userId.toString()
  ) {
    throw new ApiError(403, "Cannot remove the group owner");
  }

  if (!isSelf) {
    if (conversation.permissions.addMembers === "admins" && !isAdmin) {
      throw new ApiError(403, "Only admins can remove members");
    }
  }

  const isTargetAdmin = conversation.admins.some(
    (a) => a.toString() === userId.toString(),
  );
  const isOwner = conversation.owner?.toString() === userIdMe.toString();

  if (!isSelf && isTargetAdmin && !isOwner) {
    throw new ApiError(403, "Only the owner can remove admins");
  }

  conversation.participants = conversation.participants.filter(
    (p) => p.toString() !== userId.toString(),
  );
  conversation.admins = conversation.admins.filter(
    (a) => a.toString() !== userId.toString(),
  );
  conversation.deletedFor = conversation.deletedFor.filter(
    (id) => id.toString() !== userId.toString(),
  );

  await conversation.save();

  const action = isSelf ? "user_left" : "user_removed";
  const sysMsg = await createSystemMessage(
    conversation._id,
    action,
    userIdMe,
    isSelf ? null : userId,
  );
  const populatedMsg = await populateSystemMessage(sysMsg);

  const io = req.app.get("io");
  if (io) {
    io.to(conversation._id.toString()).emit("newMessage", populatedMsg);
  }

  res.json({ success: true, data: conversation });
});

// @route POST /api/conversations/:id/leave
export const leaveGroup = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const conversation = await Conversation.findById(id);
  if (!conversation || !conversation.isGroup)
    throw new ApiError(404, "Group not found");

  const isMember = conversation.participants.some(
    (p) => p.toString() === userId.toString(),
  );
  if (!isMember) throw new ApiError(403, "Not a member");

  if (conversation.owner?.toString() === userId.toString()) {
    throw new ApiError(
      403,
      "As the owner, you must delete the group instead of leaving",
    );
  }

  conversation.participants = conversation.participants.filter(
    (p) => p.toString() !== userId.toString(),
  );
  conversation.admins = conversation.admins.filter(
    (a) => a.toString() !== userId.toString(),
  );
  await conversation.save();

  const sysMsg = await createSystemMessage(id, "user_left", userId);
  const populatedMsg = await populateSystemMessage(sysMsg);

  const io = req.app.get("io");
  if (io) {
    io.to(id).emit("newMessage", populatedMsg);
    io.to(userId.toString()).emit("conversationLeft", { conversationId: id });
  }

  res.json({ success: true, message: "Left the group" });
});

// @route DELETE /api/conversations/:id/group
export const deleteGroup = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const conversation = await Conversation.findById(id);
  if (!conversation || !conversation.isGroup)
    throw new ApiError(404, "Group not found");

  const isOwner = conversation.owner?.toString() === userId.toString();

  if (!isOwner) {
    throw new ApiError(403, "Only the owner can delete the group");
  }

  const io = req.app.get("io");
  if (io) {
    io.to(id).emit("conversationDeleted", { conversationId: id });
  }

  await Message.deleteMany({ conversation: id });
  await Conversation.findByIdAndDelete(id);

  res.json({ success: true, message: "Group deleted" });
});

// @route POST /api/conversations/:id/admins
export const promoteToAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  const userIdMe = req.user._id;

  if (!userId) throw new ApiError(400, "userId is required");

  const conversation = await Conversation.findById(id);
  if (!conversation || !conversation.isGroup)
    throw new ApiError(404, "Group not found");

  const isOwner = conversation.owner?.toString() === userIdMe.toString();
  if (!isOwner) {
    throw new ApiError(403, "Only the owner can promote admins");
  }

  const isMember = conversation.participants.some(
    (p) => p.toString() === userId.toString(),
  );
  if (!isMember) throw new ApiError(400, "User is not a member");

  const alreadyAdmin = conversation.admins.some(
    (a) => a.toString() === userId.toString(),
  );
  if (alreadyAdmin) {
    throw new ApiError(400, "User is already an admin");
  }

  conversation.admins.push(userId);
  await conversation.save();

  const sysMsg = await createSystemMessage(
    id,
    "admin_promoted",
    userIdMe,
    userId,
  );
  const populatedMsg = await populateSystemMessage(sysMsg);

  const io = req.app.get("io");
  if (io) io.to(id).emit("newMessage", populatedMsg);

  res.json({ success: true, data: conversation });
});

// @route DELETE /api/conversations/:id/admins/:userId
export const demoteFromAdmin = asyncHandler(async (req, res) => {
  const { id, userId } = req.params;
  const userIdMe = req.user._id;

  const conversation = await Conversation.findById(id);
  if (!conversation || !conversation.isGroup)
    throw new ApiError(404, "Group not found");

  const isOwner = conversation.owner?.toString() === userIdMe.toString();
  if (!isOwner) {
    throw new ApiError(403, "Only the owner can demote admins");
  }

  if (conversation.owner?.toString() === userId.toString()) {
    throw new ApiError(400, "Cannot demote the owner");
  }

  conversation.admins = conversation.admins.filter(
    (a) => a.toString() !== userId.toString(),
  );
  await conversation.save();

  const sysMsg = await createSystemMessage(
    id,
    "admin_demoted",
    userIdMe,
    userId,
  );
  const populatedMsg = await populateSystemMessage(sysMsg);

  const io = req.app.get("io");
  if (io) io.to(id).emit("newMessage", populatedMsg);

  res.json({ success: true, data: conversation });
});

// @route PUT /api/conversations/:id/permissions
export const updatePermissions = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { sendMessages, addMembers, editGroupInfo } = req.body;
  const userIdMe = req.user._id;

  const conversation = await Conversation.findById(id);
  if (!conversation || !conversation.isGroup)
    throw new ApiError(404, "Group not found");

  const isOwner = conversation.owner?.toString() === userIdMe.toString();
  if (!isOwner) {
    throw new ApiError(403, "Only the owner can change permissions");
  }

  if (sendMessages) conversation.permissions.sendMessages = sendMessages;
  if (addMembers) conversation.permissions.addMembers = addMembers;
  if (editGroupInfo) conversation.permissions.editGroupInfo = editGroupInfo;

  await conversation.save();

  const sysMsg = await createSystemMessage(id, "permissions_changed", userIdMe);
  const populatedMsg = await populateSystemMessage(sysMsg);

  const io = req.app.get("io");
  if (io) io.to(id).emit("newMessage", populatedMsg);

  res.json({ success: true, data: conversation.permissions });
});

// ⭐ جديد: @route PUT /api/conversations/:id/pin
export const togglePinConversation = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const conversation = await Conversation.findById(id);
  if (!conversation) throw new ApiError(404, "Conversation not found");

  const isMember = conversation.participants.some(
    (p) => p.toString() === userId.toString(),
  );
  if (!isMember) throw new ApiError(403, "Not a participant");

  const uid = userId.toString();
  const isPinnedNow = conversation.pinnedBy.some((p) => p.toString() === uid);

  if (isPinnedNow) {
    conversation.pinnedBy = conversation.pinnedBy.filter(
      (p) => p.toString() !== uid,
    );
  } else {
    // ⭐ حد أقصى 3 محادثات مثبتة
    if (conversation.pinnedBy.length >= 3) {
      // لا نمنع، لكن المستخدم قد يرغب في إزالة الأقدم — نكتفي بعدم الفحص هنا
      // لأن الحد يُطبَّق على مستوى المستخدم وليس المحادثة
      // سنفحص عدد مثبتات المستخدم من المحادثات الأخرى
      const userPinnedCount = await Conversation.countDocuments({
        pinnedBy: userId,
        participants: userId,
      });

      if (userPinnedCount >= 3) {
        throw new ApiError(
          400,
          "You can only pin up to 3 conversations",
          "PIN_LIMIT_REACHED",
        );
      }
    }
    conversation.pinnedBy.push(userId);
  }

  await conversation.save();

  res.json({
    success: true,
    data: {
      isPinned: !isPinnedNow,
    },
  });
});

// ⭐ جديد: @route PUT /api/conversations/:id/mute
// Body: { duration: "8h" | "1w" | "always" | null }
// null = unmute
export const toggleMuteConversation = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { duration } = req.body;
  const userId = req.user._id;

  const conversation = await Conversation.findById(id);
  if (!conversation) throw new ApiError(404, "Conversation not found");

  const isMember = conversation.participants.some(
    (p) => p.toString() === userId.toString(),
  );
  if (!isMember) throw new ApiError(403, "Not a participant");

  const uid = userId.toString();

  // ⭐ إزالة أي كتم سابق للمستخدم
  conversation.mutedBy = conversation.mutedBy.filter(
    (m) => m.user.toString() !== uid,
  );

  let isMuted = false;
  let muteUntil = null;

  if (duration && duration !== "unmute") {
    let until = null;

    if (duration === "8h") {
      until = new Date(Date.now() + 8 * 60 * 60 * 1000);
    } else if (duration === "1w") {
      until = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    } else if (duration === "always") {
      until = null;
    } else {
      throw new ApiError(400, "Invalid duration");
    }

    conversation.mutedBy.push({
      user: userId,
      until,
      mutedAt: new Date(),
    });

    isMuted = true;
    muteUntil = until;
  }

  await conversation.save();

  res.json({
    success: true,
    data: {
      isMuted,
      muteUntil,
    },
  });
});

// ⭐ جديد: @route PUT /api/conversations/:id/archive
export const toggleArchiveConversation = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const conversation = await Conversation.findById(id);
  if (!conversation) throw new ApiError(404, "Conversation not found");

  const isMember = conversation.participants.some(
    (p) => p.toString() === userId.toString(),
  );
  if (!isMember) throw new ApiError(403, "Not a participant");

  const uid = userId.toString();
  const isArchivedNow = conversation.archivedBy.some(
    (a) => a.toString() === uid,
  );

  if (isArchivedNow) {
    conversation.archivedBy = conversation.archivedBy.filter(
      (a) => a.toString() !== uid,
    );
  } else {
    conversation.archivedBy.push(userId);

    // ⭐ إلغاء التثبيت عند الأرشفة
    conversation.pinnedBy = conversation.pinnedBy.filter(
      (p) => p.toString() !== uid,
    );
  }

  await conversation.save();

  res.json({
    success: true,
    data: {
      isArchived: !isArchivedNow,
    },
  });
});

// @route DELETE /api/conversations/:id
export const deleteConversation = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const conversation = await Conversation.findById(id);
  if (!conversation) throw new ApiError(404, "Conversation not found");

  const isMember = conversation.participants.some(
    (p) => p.toString() === userId.toString(),
  );
  if (!isMember) throw new ApiError(403, "Not a participant");

  if (conversation.isGroup) {
    if (conversation.owner?.toString() === userId.toString()) {
      throw new ApiError(403, "As the owner, use delete group instead");
    }

    conversation.participants = conversation.participants.filter(
      (p) => p.toString() !== userId.toString(),
    );
    conversation.admins = conversation.admins.filter(
      (a) => a.toString() !== userId.toString(),
    );

    const sysMsg = await createSystemMessage(id, "user_left", userId);
    const populatedMsg = await populateSystemMessage(sysMsg);

    const io = req.app.get("io");
    if (io) io.to(id).emit("newMessage", populatedMsg);
  }

  if (
    !conversation.deletedFor.some((d) => d.toString() === userId.toString())
  ) {
    conversation.deletedFor.push(userId);
  }

  await conversation.save();

  res.json({ success: true, message: "Conversation deleted" });
});

// ⭐ جديد: @route PUT /api/conversations/:id/disappearing
// Body: { duration }  // 0 | 86400 | 604800 | 7776000
export const updateDisappearing = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { duration } = req.body;
  const userId = req.user._id;

  const ALLOWED = [0, 86400, 604800, 7776000]; // off, 24h, 7d, 90d

  if (!ALLOWED.includes(duration)) {
    throw new ApiError(400, "Invalid duration");
  }

  const conversation = await Conversation.findById(id);
  if (!conversation) throw new ApiError(404, "Conversation not found");

  const isMember = conversation.participants.some(
    (p) => p.toString() === userId.toString(),
  );
  if (!isMember) throw new ApiError(403, "Not a participant");

  // ⭐ في المجموعات: فقط الأدمن/المالك
  if (conversation.isGroup) {
    const isAdmin = conversation.admins.some(
      (a) => a.toString() === userId.toString(),
    );
    const isOwner = conversation.owner?.toString() === userId.toString();

    if (!isAdmin && !isOwner) {
      throw new ApiError(403, "Only admins can change this setting");
    }
  }

  conversation.disappearingDuration = duration;
  await conversation.save();

  // ⭐ رسالة نظام
  const sysMsg = await createSystemMessage(
    id,
    "disappearing_changed",
    userId,
    null,
    { duration },
  );
  const populatedMsg = await populateSystemMessage(sysMsg);

  const io = req.app.get("io");
  if (io) {
    io.to(id).emit("newMessage", populatedMsg);
    io.to(id).emit("disappearingUpdated", { conversationId: id, duration });
  }

  res.json({
    success: true,
    data: {
      disappearingDuration: duration,
    },
  });
});
