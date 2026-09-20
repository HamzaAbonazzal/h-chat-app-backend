import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import User from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getMessageStatus } from "../utils/messageStatus.js";
import {
  incrementUnreadCounts,
  resetUnreadCount,
} from "../utils/unreadHelper.js";
import { hasBlocked } from "../utils/presenceHelper.js";
import { sendNotificationToUser } from "../utils/notificationService.js";
import { deleteCloudinaryFile } from "../utils/cloudinaryHelper.js";

const EDIT_TIME_LIMIT = 15 * 60 * 1000;
const ALLOWED_EMOJIS = ["❤️", "👍", "😂", "😮", "😢", "🙏"];

const escapeRegex = (text) => {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const isUserMuted = (conversation, userId) => {
  const uid = userId.toString();
  const muteEntry = (conversation.mutedBy || []).find(
    (m) => m.user?.toString() === uid,
  );

  if (!muteEntry) return false;
  if (!muteEntry.until) return true;
  return new Date(muteEntry.until) > new Date();
};

const populateMessage = async (message) => {
  return await message.populate([
    { path: "sender", select: "username avatar isDeleted" },
    {
      path: "replyTo",
      select: "content type mediaUrl sender isDeleted",
      populate: { path: "sender", select: "username avatar isDeleted" },
    },
    { path: "reactions.user", select: "username avatar isDeleted" },
    { path: "systemMessage.actor", select: "username avatar isDeleted" },
    { path: "systemMessage.target", select: "username avatar isDeleted" },
  ]);
};

// @route POST /api/messages
export const sendMessage = asyncHandler(async (req, res) => {
  const {
    conversationId,
    content,
    type = "text",
    mediaUrl,
    duration,
    replyToId = null,
    linkPreview = null,
  } = req.body;

  const conversation = await Conversation.findById(conversationId);
  if (!conversation) throw new ApiError(404, "Conversation not found");

  const isMember = conversation.participants.some(
    (p) => p.toString() === req.user._id.toString(),
  );
  if (!isMember) throw new ApiError(403, "Not a participant");

  if (!conversation.isGroup) {
    const otherParticipant = conversation.participants.find(
      (p) => p.toString() !== req.user._id.toString(),
    );

    if (otherParticipant) {
      const theyBlockedMe = await hasBlocked(otherParticipant, req.user._id);
      if (theyBlockedMe) {
        throw new ApiError(
          403,
          "You cannot send messages to this user",
          "USER_BLOCKED_YOU",
        );
      }
    }
  }

  let validReplyTo = null;
  if (replyToId) {
    const originalMessage = await Message.findOne({
      _id: replyToId,
      conversation: conversationId,
    });
    if (!originalMessage) {
      throw new ApiError(
        404,
        "Original message not found in this conversation",
      );
    }
    validReplyTo = originalMessage._id;
  }

  let expiresAt = null;
  if (conversation.disappearingDuration > 0) {
    expiresAt = new Date(Date.now() + conversation.disappearingDuration * 1000);
  }

  const message = await Message.create({
    conversation: conversationId,
    sender: req.user._id,
    content,
    type,
    mediaUrl,
    duration,
    replyTo: validReplyTo,
    deliveredTo: [],
    readBy: [],
    reactions: [],
    expiresAt,
    ...(linkPreview && {
      linkPreview: {
        url: linkPreview.url || "",
        title: linkPreview.title || "",
        description: linkPreview.description || "",
        image: linkPreview.image || "",
        siteName: linkPreview.siteName || "",
      },
    }),
  });

  conversation.lastMessage = message._id;
  conversation.deletedFor = [];
  conversation.archivedBy = [];
  await conversation.save();

  const populated = await populateMessage(message);
  const sender = populated.sender;

  const newCounts = await incrementUnreadCounts(conversation, req.user._id);

  const io = req.app.get("io");
  if (io) {
    io.to(conversationId).emit("newMessage", populated);
    io.to(req.user._id.toString()).emit("newMessage", {
      ...populated.toObject(),
      isMine: true,
    });

    for (const [recipientId, count] of Object.entries(newCounts)) {
      io.to(recipientId).emit("unreadCountUpdated", {
        conversationId,
        unreadCount: count,
      });
    }
  }

  try {
    const recipients = conversation.participants.filter(
      (p) => p.toString() !== req.user._id.toString(),
    );

    let notificationBody = content;
    if (type === "image") notificationBody = "📷 صورة";
    else if (type === "video") notificationBody = "🎥 فيديو";
    else if (type === "audio") notificationBody = "🎤 رسالة صوتية";
    else if (type === "file") notificationBody = "📎 ملف";

    let notificationTitle;
    if (conversation.isGroup) {
      notificationTitle = `${conversation.name} · ${sender.username}`;
    } else {
      notificationTitle = sender.username;
    }

    for (const recipientId of recipients) {
      const rid = recipientId.toString();

      if (isUserMuted(conversation, recipientId)) continue;

      const unreadCount = newCounts[rid] || 1;

      let finalBody = notificationBody;
      if (unreadCount > 1) finalBody = `${unreadCount} رسائل جديدة`;

      sendNotificationToUser(rid, {
        title: notificationTitle,
        body: finalBody,
        data: {
          type: "new_message",
          conversationId: conversationId.toString(),
          messageId: message._id.toString(),
          senderId: req.user._id.toString(),
          senderName: sender.username,
          link: `/chat/${conversationId}`,
        },
      }).catch((err) => console.error("Notification error:", err.message));
    }
  } catch (notifErr) {
    console.error("Notification sending error:", notifErr.message);
  }

  res.status(201).json({
    success: true,
    data: {
      ...populated.toObject(),
      status: "sent",
    },
  });
});

// @route POST /api/messages/forward
export const forwardMessage = asyncHandler(async (req, res) => {
  const { messageId, conversationId } = req.body;

  if (!messageId || !conversationId) {
    throw new ApiError(400, "messageId and conversationId are required");
  }

  const originalMessage = await Message.findById(messageId);
  if (!originalMessage) throw new ApiError(404, "Original message not found");
  if (originalMessage.isDeleted) {
    throw new ApiError(400, "Cannot forward a deleted message");
  }

  const originalConversation = await Conversation.findById(
    originalMessage.conversation,
  );
  if (!originalConversation)
    throw new ApiError(404, "Original conversation not found");

  const wasParticipant = originalConversation.participants.some(
    (p) => p.toString() === req.user._id.toString(),
  );
  if (!wasParticipant) {
    throw new ApiError(
      403,
      "You cannot forward a message you don't have access to",
    );
  }

  const targetConversation = await Conversation.findById(conversationId);
  if (!targetConversation)
    throw new ApiError(404, "Target conversation not found");

  const isTargetMember = targetConversation.participants.some(
    (p) => p.toString() === req.user._id.toString(),
  );
  if (!isTargetMember)
    throw new ApiError(403, "Not a participant in target conversation");

  if (!targetConversation.isGroup) {
    const otherParticipant = targetConversation.participants.find(
      (p) => p.toString() !== req.user._id.toString(),
    );
    if (otherParticipant) {
      const theyBlockedMe = await hasBlocked(otherParticipant, req.user._id);
      if (theyBlockedMe) {
        throw new ApiError(
          403,
          "You cannot send messages to this user",
          "USER_BLOCKED_YOU",
        );
      }
    }
  }

  const originalSenderId = originalMessage.sender;

  let expiresAt = null;
  if (targetConversation.disappearingDuration > 0) {
    expiresAt = new Date(
      Date.now() + targetConversation.disappearingDuration * 1000,
    );
  }

  const newMessage = await Message.create({
    conversation: conversationId,
    sender: req.user._id,
    content: originalMessage.content,
    type: originalMessage.type,
    mediaUrl: originalMessage.mediaUrl,
    duration: originalMessage.duration,
    forwardedFrom: originalSenderId,
    deliveredTo: [],
    readBy: [],
    reactions: [],
    expiresAt,
    ...(originalMessage.linkPreview?.url && {
      linkPreview: {
        url: originalMessage.linkPreview.url,
        title: originalMessage.linkPreview.title,
        description: originalMessage.linkPreview.description,
        image: originalMessage.linkPreview.image,
        siteName: originalMessage.linkPreview.siteName,
      },
    }),
  });

  targetConversation.lastMessage = newMessage._id;
  targetConversation.deletedFor = [];
  targetConversation.archivedBy = [];
  await targetConversation.save();

  const populated = await populateMessage(newMessage);
  const sender = populated.sender;

  const newCounts = await incrementUnreadCounts(
    targetConversation,
    req.user._id,
  );

  const io = req.app.get("io");
  if (io) {
    const messageToSend = {
      ...populated.toObject(),
      isForwarded: true,
    };
    io.to(conversationId).emit("newMessage", messageToSend);
    io.to(req.user._id.toString()).emit("newMessage", {
      ...messageToSend,
      isMine: true,
    });

    for (const [recipientId, count] of Object.entries(newCounts)) {
      io.to(recipientId).emit("unreadCountUpdated", {
        conversationId,
        unreadCount: count,
      });
    }
  }

  try {
    const recipients = targetConversation.participants.filter(
      (p) => p.toString() !== req.user._id.toString(),
    );

    let notificationTitle;
    if (targetConversation.isGroup) {
      notificationTitle = `${targetConversation.name} · ${sender.username}`;
    } else {
      notificationTitle = sender.username;
    }

    for (const recipientId of recipients) {
      const rid = recipientId.toString();

      if (isUserMuted(targetConversation, recipientId)) continue;

      const unreadCount = newCounts[rid] || 1;

      let finalBody = newMessage.content;
      if (newMessage.type === "image") finalBody = "📷 صورة";
      else if (newMessage.type === "video") finalBody = "🎥 فيديو";
      else if (newMessage.type === "audio") finalBody = "🎤 رسالة صوتية";
      else if (newMessage.type === "file") finalBody = "📎 ملف";

      if (unreadCount > 1) finalBody = `${unreadCount} رسائل جديدة`;

      sendNotificationToUser(rid, {
        title: notificationTitle,
        body: finalBody,
        data: {
          type: "new_message",
          conversationId: conversationId.toString(),
          messageId: newMessage._id.toString(),
          senderId: req.user._id.toString(),
          senderName: sender.username,
          link: `/chat/${conversationId}`,
        },
      }).catch((err) => console.error("Notification error:", err.message));
    }
  } catch (notifErr) {
    console.error("Notification sending error:", notifErr.message);
  }

  res.status(201).json({
    success: true,
    data: {
      ...populated.toObject(),
      isForwarded: true,
      status: "sent",
    },
  });
});

// @route GET /api/messages/:conversationId
export const getMessages = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 30;
  const skip = (page - 1) * limit;

  const conversation = await Conversation.findById(conversationId).populate(
    "participants",
    "_id",
  );
  if (!conversation) throw new ApiError(404, "Conversation not found");

  const isMember = conversation.participants.some(
    (p) => p._id.toString() === req.user._id.toString(),
  );
  if (!isMember) throw new ApiError(403, "Not a participant");

  const now = new Date();
  const clearedAt = conversation.clearedAt?.get(req.user._id.toString());

  const query = {
    conversation: conversationId,
    deletedFor: { $ne: req.user._id },
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
  };

  if (clearedAt) {
    query.createdAt = { $gt: clearedAt };
  }

  const messages = await Message.find(query)
    .populate("sender", "username avatar isDeleted")
    .populate({
      path: "replyTo",
      select: "content type mediaUrl sender isDeleted",
      populate: { path: "sender", select: "username avatar isDeleted" },
    })
    .populate("reactions.user", "username avatar isDeleted")
    .populate("systemMessage.actor", "username avatar isDeleted")
    .populate("systemMessage.target", "username avatar isDeleted")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const uid = req.user._id.toString();

  const messagesWithStatus = messages.reverse().map((msg) => {
    const obj = msg.toObject();
    if (obj.forwardedFrom) {
      obj.isForwarded = true;
    }
    return {
      ...obj,
      isStarred: (obj.starredBy || []).some((id) => id.toString() === uid),
      status: getMessageStatus(msg, conversation, req.user._id),
    };
  });

  res.json({
    success: true,
    data: messagesWithStatus,
    pagination: { page, limit },
  });
});

// ⭐ جديد: GET /api/messages/:id/context
export const getMessageContext = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const limit = parseInt(req.query.limit) || 15;

  const targetMessage = await Message.findById(id);
  if (!targetMessage) throw new ApiError(404, "Message not found");

  const conversation = await Conversation.findById(
    targetMessage.conversation,
  ).populate("participants", "_id");
  if (!conversation) throw new ApiError(404, "Conversation not found");

  const isMember = conversation.participants.some(
    (p) => p._id.toString() === req.user._id.toString(),
  );
  if (!isMember) throw new ApiError(403, "Not a participant");

  const now = new Date();
  const populateOpts = [
    { path: "sender", select: "username avatar" },
    {
      path: "replyTo",
      select: "content type mediaUrl sender isDeleted",
      populate: { path: "sender", select: "username avatar" },
    },
    { path: "reactions.user", select: "username avatar" },
    { path: "systemMessage.actor", select: "username avatar" },
    { path: "systemMessage.target", select: "username avatar" },
  ];

  const baseQuery = {
    conversation: conversation._id,
    deletedFor: { $ne: req.user._id },
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
  };

  const before = await Message.find({
    ...baseQuery,
    createdAt: { $lt: targetMessage.createdAt },
  })
    .populate(populateOpts)
    .sort({ createdAt: -1 })
    .limit(limit);

  const target = await Message.findById(id).populate(populateOpts);

  const after = await Message.find({
    ...baseQuery,
    createdAt: { $gt: targetMessage.createdAt },
  })
    .populate(populateOpts)
    .sort({ createdAt: 1 })
    .limit(limit);

  const allMessages = [...before.reverse(), target, ...after];

  const uid = req.user._id.toString();

  const formatted = allMessages.map((msg) => {
    const obj = msg.toObject();
    if (obj.forwardedFrom) obj.isForwarded = true;
    return {
      ...obj,
      isStarred: (obj.starredBy || []).some((id) => id.toString() === uid),
      status: getMessageStatus(msg, conversation, req.user._id),
    };
  });

  res.json({
    success: true,
    data: formatted,
    targetId: id,
  });
});

// ⭐ جديد: DELETE /api/messages/conversation/:conversationId/clear
export const clearConversationMessages = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const userId = req.user._id;

  const conversation = await Conversation.findById(conversationId);
  if (!conversation) throw new ApiError(404, "Conversation not found");

  const isMember = conversation.participants.some(
    (p) => p.toString() === userId.toString(),
  );
  if (!isMember) throw new ApiError(403, "Not a participant");

  if (!conversation.clearedAt) {
    conversation.clearedAt = new Map();
  }
  conversation.clearedAt.set(userId.toString(), new Date());
  await conversation.save();

  await resetUnreadCount(conversationId, userId);

  const io = req.app.get("io");
  if (io) {
    io.to(userId.toString()).emit("conversationCleared", { conversationId });
  }

  res.json({ success: true, message: "Conversation cleared" });
});

// @route GET /api/messages/:conversationId/search
export const searchMessagesInConversation = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const { q } = req.query;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 30;
  const skip = (page - 1) * limit;

  if (!q || q.trim().length < 2) {
    throw new ApiError(400, "Search query must be at least 2 characters");
  }

  const conversation = await Conversation.findById(conversationId).populate(
    "participants",
    "_id",
  );
  if (!conversation) throw new ApiError(404, "Conversation not found");

  const isMember = conversation.participants.some(
    (p) => p._id.toString() === req.user._id.toString(),
  );
  if (!isMember) throw new ApiError(403, "Not a participant");

  const escaped = escapeRegex(q.trim());
  const regex = new RegExp(escaped, "i");

  const now = new Date();
  const clearedAt = conversation.clearedAt?.get(req.user._id.toString());

  const query = {
    conversation: conversationId,
    isDeleted: false,
    deletedFor: { $ne: req.user._id },
    content: { $regex: regex },
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
  };

  if (clearedAt) {
    query.createdAt = { $gt: clearedAt };
  }

  const total = await Message.countDocuments(query);

  const messages = await Message.find(query)
    .populate("sender", "username avatar")
    .populate("reactions.user", "username avatar")
    .populate("systemMessage.actor", "username avatar")
    .populate("systemMessage.target", "username avatar")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const uid = req.user._id.toString();

  const messagesWithStatus = messages.map((msg) => ({
    ...msg.toObject(),
    isStarred: (msg.starredBy || []).some((id) => id.toString() === uid),
    status: getMessageStatus(msg, conversation, req.user._id),
  }));

  res.json({
    success: true,
    data: messagesWithStatus,
    pagination: {
      page,
      limit,
      total,
      hasMore: skip + messages.length < total,
    },
  });
});

// @route GET /api/messages/search/all
export const searchAllMessages = asyncHandler(async (req, res) => {
  const { q } = req.query;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  if (!q || q.trim().length < 2) {
    throw new ApiError(400, "Search query must be at least 2 characters");
  }

  const escaped = escapeRegex(q.trim());
  const regex = new RegExp(escaped, "i");

  const userConversations = await Conversation.find({
    participants: req.user._id,
  }).select("_id clearedAt");

  const conversationIds = userConversations.map((c) => c._id);

  // ⭐ نبني الاستعلام لكل محادثة مع مراعاة clearedAt
  const now = new Date();
  const orConditions = userConversations.map((c) => {
    const clearedAt = c.clearedAt?.get(req.user._id.toString());
    const base = {
      conversation: c._id,
      isDeleted: false,
      deletedFor: { $ne: req.user._id },
      content: { $regex: regex },
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    };
    if (clearedAt) {
      base.createdAt = { $gt: clearedAt };
    }
    return base;
  });

  const query =
    orConditions.length > 0 ? { $or: orConditions } : { _id: { $in: [] } }; // لا محادثات

  const total = await Message.countDocuments(query);

  const messages = await Message.find(query)
    .populate("sender", "username avatar")
    .populate({
      path: "conversation",
      select: "name isGroup participants groupAvatar",
      populate: { path: "participants", select: "username avatar" },
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  res.json({
    success: true,
    data: messages,
    pagination: {
      page,
      limit,
      total,
      hasMore: skip + messages.length < total,
    },
  });
});

// @route GET /api/messages/starred
export const getStarredMessages = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 30;
  const skip = (page - 1) * limit;
  const { conversationId } = req.query;

  const userConversations = await Conversation.find({
    participants: userId,
  }).select("_id");

  const conversationIds = userConversations.map((c) => c._id);

  const query = {
    conversation: { $in: conversationIds },
    starredBy: userId,
    isDeleted: false,
    deletedFor: { $ne: userId },
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  };

  if (conversationId) {
    const isMember = conversationIds.some(
      (id) => id.toString() === conversationId,
    );
    if (!isMember) {
      throw new ApiError(403, "You are not a participant in this conversation");
    }
    query.conversation = conversationId;
  }

  const total = await Message.countDocuments(query);

  const messages = await Message.find(query)
    .populate("sender", "username avatar")
    .populate({
      path: "conversation",
      select: "name isGroup participants groupAvatar",
      populate: { path: "participants", select: "username avatar" },
    })
    .sort({ updatedAt: -1 })
    .skip(skip)
    .limit(limit);

  const formatted = messages.map((msg) => ({
    ...msg.toObject(),
    isStarred: true,
  }));

  res.json({
    success: true,
    data: formatted,
    pagination: {
      page,
      limit,
      total,
      hasMore: skip + messages.length < total,
    },
  });
});

// @route PUT /api/messages/:id
export const editMessage = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;

  if (!content || !content.trim()) {
    throw new ApiError(400, "Content is required");
  }

  const message = await Message.findById(id);
  if (!message) throw new ApiError(404, "Message not found");

  if (message.sender.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You can only edit your own messages");
  }

  if (message.isDeleted) {
    throw new ApiError(400, "Cannot edit a deleted message");
  }

  if (message.type !== "text") {
    throw new ApiError(400, "Only text messages can be edited");
  }

  const age = Date.now() - new Date(message.createdAt).getTime();
  if (age > EDIT_TIME_LIMIT) {
    throw new ApiError(
      400,
      "Time limit for editing messages has passed",
      "EDIT_TIME_EXPIRED",
    );
  }

  message.content = content.trim();
  message.editedAt = new Date();
  await message.save();

  const populated = await populateMessage(message);

  const io = req.app.get("io");
  if (io) {
    io.to(message.conversation.toString()).emit("messageEdited", {
      messageId: message._id,
      conversationId: message.conversation,
      content: message.content,
      editedAt: message.editedAt,
    });
  }

  res.json({
    success: true,
    data: populated,
  });
});

// @route POST /api/messages/:id/reactions
export const toggleReaction = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { emoji } = req.body;
  const userId = req.user._id;

  if (!emoji) {
    throw new ApiError(400, "emoji is required");
  }

  if (!ALLOWED_EMOJIS.includes(emoji)) {
    throw new ApiError(400, "Invalid emoji");
  }

  const message = await Message.findById(id);
  if (!message) throw new ApiError(404, "Message not found");

  if (message.isDeleted) {
    throw new ApiError(400, "Cannot react to a deleted message");
  }

  const conversation = await Conversation.findById(message.conversation);
  if (!conversation) throw new ApiError(404, "Conversation not found");

  const isMember = conversation.participants.some(
    (p) => p.toString() === userId.toString(),
  );
  if (!isMember) {
    throw new ApiError(403, "You are not a participant in this conversation");
  }

  const existingIndex = message.reactions.findIndex(
    (r) => r.user.toString() === userId.toString(),
  );

  let action = "added";

  if (existingIndex !== -1) {
    if (message.reactions[existingIndex].emoji === emoji) {
      message.reactions.splice(existingIndex, 1);
      action = "removed";
    } else {
      message.reactions[existingIndex].emoji = emoji;
      message.reactions[existingIndex].createdAt = new Date();
      action = "updated";
    }
  } else {
    message.reactions.push({
      user: userId,
      emoji,
      createdAt: new Date(),
    });
  }

  await message.save();
  await message.populate("reactions.user", "username avatar");

  const io = req.app.get("io");
  if (io) {
    io.to(message.conversation.toString()).emit("messageReaction", {
      messageId: message._id,
      conversationId: message.conversation,
      reactions: message.reactions,
      action,
      userId,
      emoji,
    });
  }

  res.json({
    success: true,
    data: {
      reactions: message.reactions,
      action,
    },
  });
});

// @route PUT /api/messages/:id/star
export const toggleStar = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const message = await Message.findById(id);
  if (!message) throw new ApiError(404, "Message not found");

  if (message.isDeleted) {
    throw new ApiError(400, "Cannot star a deleted message");
  }

  const conversation = await Conversation.findById(message.conversation);
  if (!conversation) throw new ApiError(404, "Conversation not found");

  const isMember = conversation.participants.some(
    (p) => p.toString() === userId.toString(),
  );
  if (!isMember) {
    throw new ApiError(403, "You are not a participant in this conversation");
  }

  const uid = userId.toString();
  const alreadyStarred = message.starredBy.some((id) => id.toString() === uid);

  let isStarred;

  if (alreadyStarred) {
    message.starredBy = message.starredBy.filter((id) => id.toString() !== uid);
    isStarred = false;
  } else {
    message.starredBy.push(userId);
    isStarred = true;
  }

  await message.save();

  res.json({
    success: true,
    data: {
      isStarred,
      messageId: message._id,
    },
  });
});

// @route GET /api/messages/:id/info
export const getMessageInfo = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const message = await Message.findById(id)
    .populate("sender", "username avatar")
    .populate("deliveredTo", "username avatar")
    .populate("readBy", "username avatar");

  if (!message) throw new ApiError(404, "Message not found");

  if (!message.sender) {
    throw new ApiError(400, "System messages have no info");
  }

  if (message.sender._id.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Only the sender can view message info");
  }

  const conversation = await Conversation.findById(
    message.conversation,
  ).populate("participants", "username avatar isOnline lastSeen");

  if (!conversation) throw new ApiError(404, "Conversation not found");

  let groupInfo = null;

  if (conversation.isGroup) {
    const senderId = message.sender._id.toString();
    const readByIds = new Set(message.readBy.map((u) => u._id.toString()));
    const deliveredToIds = new Set(
      message.deliveredTo.map((u) => u._id.toString()),
    );

    const readByUsers = [];
    const deliveredNotReadUsers = [];
    const pendingUsers = [];

    for (const p of conversation.participants) {
      if (p._id.toString() === senderId) continue;

      if (readByIds.has(p._id.toString())) {
        readByUsers.push(p);
      } else if (deliveredToIds.has(p._id.toString())) {
        deliveredNotReadUsers.push(p);
      } else {
        pendingUsers.push(p);
      }
    }

    groupInfo = {
      isGroup: true,
      readBy: readByUsers,
      deliveredNotRead: deliveredNotReadUsers,
      pending: pendingUsers,
    };
  }

  res.json({
    success: true,
    data: {
      message: {
        _id: message._id,
        content: message.content,
        type: message.type,
        mediaUrl: message.mediaUrl,
        createdAt: message.createdAt,
        editedAt: message.editedAt,
      },
      deliveredTo: message.deliveredTo,
      readBy: message.readBy,
      groupInfo,
    },
  });
});

// @route POST /api/messages/delivered
export const markAsDelivered = asyncHandler(async (req, res) => {
  const { messageIds } = req.body;
  if (!Array.isArray(messageIds) || messageIds.length === 0) {
    throw new ApiError(400, "messageIds array is required");
  }

  const messages = await Message.find({ _id: { $in: messageIds } });
  const io = req.app.get("io");
  const userId = req.user._id;

  for (const message of messages) {
    if (!message.sender) continue;
    if (message.sender.toString() === userId.toString()) continue;

    if (
      !message.deliveredTo.some((id) => id.toString() === userId.toString())
    ) {
      message.deliveredTo.push(userId);
      await message.save();

      if (io) {
        io.to(message.sender.toString()).emit("messageDelivered", {
          messageId: message._id,
          conversationId: message.conversation,
          deliveredTo: userId,
          deliveredAt: new Date(),
        });
      }
    }
  }

  res.json({ success: true, message: "Messages marked as delivered" });
});

// @route POST /api/messages/read
export const markAsRead = asyncHandler(async (req, res) => {
  const { messageIds } = req.body;
  if (!Array.isArray(messageIds) || messageIds.length === 0) {
    throw new ApiError(400, "messageIds array is required");
  }

  const messages = await Message.find({ _id: { $in: messageIds } });
  const io = req.app.get("io");
  const userId = req.user._id;

  const me = await User.findById(userId).select("privacy");
  const readReceiptsEnabled = me?.privacy?.readReceipts !== false;

  for (const message of messages) {
    if (!message.sender) continue;
    if (message.sender.toString() === userId.toString()) continue;

    let changed = false;

    if (
      !message.deliveredTo.some((id) => id.toString() === userId.toString())
    ) {
      message.deliveredTo.push(userId);
      changed = true;
    }
    if (!message.readBy.some((id) => id.toString() === userId.toString())) {
      message.readBy.push(userId);
      changed = true;
    }

    if (changed) {
      await message.save();
      if (io && readReceiptsEnabled) {
        io.to(message.sender.toString()).emit("messageRead", {
          messageId: message._id,
          conversationId: message.conversation,
          readBy: userId,
          readAt: new Date(),
        });
      }
    }
  }

  res.json({ success: true, message: "Messages marked as read" });
});

// @route PUT /api/messages/:conversationId/read-all
export const markConversationAsRead = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const userId = req.user._id;

  const conversation = await Conversation.findById(conversationId);
  if (!conversation) throw new ApiError(404, "Conversation not found");

  const isMember = conversation.participants.some(
    (p) => p.toString() === userId.toString(),
  );
  if (!isMember) throw new ApiError(403, "Not a participant");

  const now = new Date();

  const unreadMessages = await Message.find({
    conversation: conversationId,
    sender: { $ne: userId },
    readBy: { $ne: userId },
    isDeleted: false,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
  });

  let messageIds = [];
  let senderIds = [];

  if (unreadMessages.length > 0) {
    messageIds = unreadMessages.map((m) => m._id);

    await Message.updateMany(
      { _id: { $in: messageIds } },
      {
        $addToSet: {
          readBy: userId,
          deliveredTo: userId,
        },
      },
    );

    senderIds = [
      ...new Set(
        unreadMessages.filter((m) => m.sender).map((m) => m.sender.toString()),
      ),
    ];
  }

  await resetUnreadCount(conversationId, userId);

  const me = await User.findById(userId).select("privacy");
  const readReceiptsEnabled = me?.privacy?.readReceipts !== false;

  const io = req.app.get("io");
  if (io) {
    if (readReceiptsEnabled) {
      for (const senderId of senderIds) {
        io.to(senderId).emit("messagesRead", {
          conversationId,
          readBy: userId,
          messageIds,
          readAt: new Date(),
        });
      }
    }

    io.to(userId.toString()).emit("unreadCountUpdated", {
      conversationId,
      unreadCount: 0,
    });
  }

  res.json({
    success: true,
    updated: unreadMessages.length,
  });
});

// @route DELETE /api/messages/:id?forEveryone=true
export const deleteMessage = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const forEveryone = req.query.forEveryone === "true";

  const message = await Message.findById(id);
  if (!message) throw new ApiError(404, "Message not found");

  const userId = req.user._id;

  if (forEveryone) {
    if (message.sender.toString() !== userId.toString()) {
      throw new ApiError(
        403,
        "You can only delete your own messages for everyone",
      );
    }

    // ⭐ احفظ URL قبل الحذف لحذفه من Cloudinary
    const mediaUrlToDelete = message.mediaUrl;

    message.isDeleted = true;
    message.deletedAt = new Date();
    message.content = "";
    message.mediaUrl = "";
    message.reactions = [];
    await message.save();

    // ⭐ احذف من Cloudinary (async — لا ننتظر)
    if (mediaUrlToDelete) {
      deleteCloudinaryFile(mediaUrlToDelete).catch((err) =>
        console.warn("Cloudinary cleanup failed:", err.message),
      );
    }

    const io = req.app.get("io");
    if (io) {
      io.to(message.conversation.toString()).emit("messageDeleted", {
        messageId: message._id,
        conversationId: message.conversation,
        forEveryone: true,
      });
    }

    return res.json({
      success: true,
      message: "Message deleted for everyone",
    });
  }

  const conversation = await Conversation.findById(message.conversation);
  const isMember = conversation.participants.some(
    (p) => p.toString() === userId.toString(),
  );
  if (!isMember) {
    throw new ApiError(403, "You are not a participant in this conversation");
  }

  if (!message.deletedFor.some((d) => d.toString() === userId.toString())) {
    message.deletedFor.push(userId);
    await message.save();
  }

  res.json({
    success: true,
    message: "Message deleted for you",
  });
});

// ⭐ جديد: @route PUT /api/messages/:id/pin
// تثبيت / إلغاء تثبيت رسالة
export const togglePinMessage = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;
  const MAX_PINS = 3;

  const message = await Message.findById(id);
  if (!message) throw new ApiError(404, "Message not found");

  if (message.isDeleted) {
    throw new ApiError(400, "Cannot pin a deleted message");
  }

  if (message.type === "system") {
    throw new ApiError(400, "Cannot pin a system message");
  }

  const conversation = await Conversation.findById(message.conversation);
  if (!conversation) throw new ApiError(404, "Conversation not found");

  const isMember = conversation.participants.some(
    (p) => p.toString() === userId.toString(),
  );
  if (!isMember) {
    throw new ApiError(403, "Not a participant");
  }

  // ⭐ في المجموعات: الأدمن فقط؟ (نسمح للجميع مثل واتساب)
  // إذا أردت تقييدها، فعّل هذا:
  // if (conversation.isGroup) {
  //   const isAdmin = conversation.admins.some((a) => a.toString() === userId.toString());
  //   if (!isAdmin) throw new ApiError(403, "Only admins can pin");
  // }

  const alreadyPinned = conversation.pinnedMessages.some(
    (m) => m.toString() === id,
  );

  let isPinned;

  if (alreadyPinned) {
    // إلغاء التثبيت
    conversation.pinnedMessages = conversation.pinnedMessages.filter(
      (m) => m.toString() !== id,
    );
    isPinned = false;
  } else {
    // تثبيت جديد
    if (conversation.pinnedMessages.length >= MAX_PINS) {
      throw new ApiError(
        400,
        `You can only pin up to ${MAX_PINS} messages`,
        "PIN_MESSAGE_LIMIT_REACHED",
      );
    }
    conversation.pinnedMessages.push(message._id);
    isPinned = true;
  }

  await conversation.save();

  // ⭐ رسالة نظام
  const action = isPinned ? "message_pinned" : "message_unpinned";
  const sysMsg = await Message.create({
    conversation: conversation._id,
    sender: null,
    type: "system",
    content: "",
    systemMessage: {
      action,
      actor: userId,
      metadata: {
        pinnedMessageId: message._id,
        pinnedPreview:
          message.type === "text"
            ? message.content?.slice(0, 50)
            : message.type,
      },
    },
  });

  await sysMsg.populate([
    { path: "systemMessage.actor", select: "username avatar" },
  ]);

  // ⭐ بث للجميع
  const io = req.app.get("io");
  if (io) {
    io.to(conversation._id.toString()).emit("messagePinned", {
      conversationId: conversation._id,
      messageId: message._id,
      isPinned,
      pinnedMessages: conversation.pinnedMessages,
      systemMessage: sysMsg,
    });
  }

  res.json({
    success: true,
    data: {
      isPinned,
      messageId: message._id,
      pinnedMessages: conversation.pinnedMessages,
    },
  });
});

// ⭐ جديد: @route GET /api/messages/:conversationId/pinned
// جلب كل الرسائل المثبتة في محادثة
export const getPinnedMessages = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const userId = req.user._id;

  const conversation = await Conversation.findById(conversationId).populate({
    path: "pinnedMessages",
    populate: [
      { path: "sender", select: "username avatar" },
      {
        path: "replyTo",
        select: "content type mediaUrl sender isDeleted",
        populate: { path: "sender", select: "username avatar" },
      },
      { path: "reactions.user", select: "username avatar" },
    ],
  });

  if (!conversation) throw new ApiError(404, "Conversation not found");

  const isMember = conversation.participants.some(
    (p) => p.toString() === userId.toString(),
  );
  if (!isMember) throw new ApiError(403, "Not a participant");

  const now = new Date();

  // ⭐ فلترة المحذوفة والمنتهية
  const validPinned = (conversation.pinnedMessages || []).filter((msg) => {
    if (!msg) return false;
    if (msg.isDeleted) return false;
    if (msg.expiresAt && new Date(msg.expiresAt) <= now) return false;
    if (msg.deletedFor?.some((id) => id.toString() === userId.toString()))
      return false;
    return true;
  });

  res.json({
    success: true,
    data: validPinned,
  });
});
