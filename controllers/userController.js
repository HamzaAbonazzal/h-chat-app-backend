import User from "../models/User.js";
import Block from "../models/Block.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  getUserContacts,
  buildPresenceResponse,
  buildUserResponse,
} from "../utils/presenceHelper.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";

// @route GET /api/users?search=
export const getUsers = asyncHandler(async (req, res) => {
  const keyword = req.query.search
    ? {
        $or: [
          { username: { $regex: req.query.search, $options: "i" } },
          { email: { $regex: req.query.search, $options: "i" } },
        ],
      }
    : {};

  // استثناء المحظورين
  const blocks = await Block.find({
    $or: [{ blocker: req.user._id }, { blocked: req.user._id }],
  });

  const excludedIds = new Set();
  excludedIds.add(req.user._id.toString());
  for (const b of blocks) {
    excludedIds.add(b.blocker.toString());
    excludedIds.add(b.blocked.toString());
  }

  const users = await User.find({
    ...keyword,
    _id: { $nin: Array.from(excludedIds) },
  }).select("-password -refreshToken -privacy");

  // جهات الاتصال لمعرفة الخصوصية
  const myContacts = await getUserContacts(req.user._id);
  const contactsSet = new Set(myContacts.map((c) => c.toString()));

  const formatted = users.map((u) => {
    const isContact = contactsSet.has(u._id.toString());
    return buildUserResponse(u, req.user._id, isContact);
  });

  res.json({ success: true, data: formatted });
});

// @route GET /api/users/:id
export const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select(
    "-password -refreshToken",
  );
  if (!user) throw new ApiError(404, "User not found");

  const myContacts = await getUserContacts(req.user._id);
  const isContact = myContacts.some(
    (c) => c.toString() === user._id.toString(),
  );

  const data = buildUserResponse(user, req.user._id, isContact);
  res.json({ success: true, data });
});

// @route PUT /api/users/profile
export const updateProfile = asyncHandler(async (req, res) => {
  const { username, bio, avatar } = req.body;
  const user = await User.findById(req.user._id);

  if (username) user.username = username;
  if (bio !== undefined) user.bio = bio;
  if (avatar) user.avatar = avatar;

  await user.save();
  res.json({ success: true, data: user });
});

// @route PUT /api/users/password
export const updatePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select("+password");

  if (!(await user.matchPassword(currentPassword))) {
    throw new ApiError(401, "Current password is incorrect");
  }

  user.password = newPassword;
  await user.save();
  res.json({ success: true, message: "Password updated" });
});

// @route POST /api/users/status
export const getUsersStatus = asyncHandler(async (req, res) => {
  const { userIds } = req.body;

  if (!Array.isArray(userIds) || userIds.length === 0) {
    throw new ApiError(400, "userIds array is required");
  }

  const users = await User.find({
    _id: { $in: userIds },
  }).select("username avatar isOnline lastSeen privacy");

  const myContacts = await getUserContacts(req.user._id);
  const contactsSet = new Set(myContacts.map((c) => c.toString()));

  const result = users.map((u) => {
    const isContact = contactsSet.has(u._id.toString());
    return buildPresenceResponse(u, req.user._id, isContact);
  });

  res.json({ success: true, data: result });
});

// @route GET /api/users/:id/status
export const getUserStatus = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select(
    "username avatar isOnline lastSeen privacy",
  );
  if (!user) throw new ApiError(404, "User not found");

  const myContacts = await getUserContacts(req.user._id);
  const isContact = myContacts.some(
    (c) => c.toString() === user._id.toString(),
  );

  const data = buildPresenceResponse(user, req.user._id, isContact);
  res.json({ success: true, data });
});

// @route PUT /api/users/privacy
export const updatePrivacy = asyncHandler(async (req, res) => {
  const { lastSeen, profilePhoto, about, readReceipts } = req.body;
  const user = await User.findById(req.user._id);

  if (!user.privacy) user.privacy = {};

  const validValues = ["everyone", "contacts", "nobody"];

  if (lastSeen) {
    if (!validValues.includes(lastSeen))
      throw new ApiError(400, "Invalid lastSeen value");
    user.privacy.lastSeen = lastSeen;
  }

  if (profilePhoto) {
    if (!validValues.includes(profilePhoto))
      throw new ApiError(400, "Invalid profilePhoto value");
    user.privacy.profilePhoto = profilePhoto;
  }

  if (about) {
    if (!validValues.includes(about))
      throw new ApiError(400, "Invalid about value");
    user.privacy.about = about;
  }

  if (typeof readReceipts === "boolean") {
    user.privacy.readReceipts = readReceipts;
  }

  await user.save();
  res.json({ success: true, data: user.privacy });
});

// ⭐ @route   DELETE /api/users/me
// @desc     حذف حساب المستخدم الحالي (soft delete)
// @access  Private
export const deleteAccount = asyncHandler(async (req, res) => {
  const { password, reason } = req.body;
  const userId = req.user._id;

  // ⭐ 1) التحقق من كلمة المرور
  if (!password) {
    throw new ApiError(400, "Password is required to delete account");
  }

  const user = await User.findById(userId).select("+password");
  if (!user) throw new ApiError(404, "User not found");

  if (user.isDeleted) {
    throw new ApiError(400, "Account is already deleted");
  }

  const isMatch = await user.matchPassword(password);
  if (!isMatch) {
    throw new ApiError(401, "Password is incorrect", "INVALID_PASSWORD");
  }

  // ⭐ 2) تسجيل الخروج من كل الأجهزة
  const io = req.app.get("io");
  if (io) {
    io.to(userId.toString()).emit("accountDeleted", {
      message: "Your account has been deleted",
    });
  }

  // ⭐ 3) مسح البيانات الشخصية
  user.username = `deleted_${userId.toString().slice(-8)}`;
  user.email = `deleted_${userId.toString().slice(-8)}@deleted.local`;
  user.avatar = "";
  user.bio = "";
  user.isOnline = false;
  user.lastSeen = new Date();
  user.fcmTokens = [];
  user.refreshToken = undefined;

  // ⭐ 4) تعليم كـ محذوف
  user.isDeleted = true;
  user.deletedAt = new Date();
  // ⭐ الحذف النهائي بعد 30 يوماً
  user.hardDeleteAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  if (reason) {
    // يمكن حفظ السبب في log للتحليل
    console.log(`📝 Account deletion reason from ${userId}: ${reason}`);
  }

  await user.save({ validateBeforeSave: false });

  // ⭐ 5) حذف كل الحظر (في الاتجاهين)
  await Block.deleteMany({
    $or: [{ blocker: userId }, { blocked: userId }],
  });

  // ⭐ 6) إزالة المستخدم من كل المحادثات
  await Conversation.updateMany(
    { participants: userId },
    {
      $pull: {
        participants: userId,
        admins: userId,
        pinnedBy: userId,
        archivedBy: userId,
        mutedBy: { user: userId },
        deletedFor: userId,
      },
    },
  );

  // ⭐ 7) التعامل مع المحادثات الفردية الفارغة
  const oneOnOneConversations = await Conversation.find({
    isGroup: false,
    participants: { $size: 0 },
  });

  for (const conv of oneOnOneConversations) {
    await Message.deleteMany({ conversation: conv._id });
    await Conversation.findByIdAndDelete(conv._id);
  }

  // ⭐ 8) التعامل مع المجموعات الفارغة (حيث كان آخر عضو)
  const emptyGroups = await Conversation.find({
    isGroup: true,
    participants: { $size: 0 },
  });

  for (const group of emptyGroups) {
    await Message.deleteMany({ conversation: group._id });
    await Conversation.findByIdAndDelete(group._id);
  }

  // ⭐ 9) إعلام جهات الاتصال بحذف الحساب
  if (io) {
    io.emit("userDeleted", { userId });
  }

  res.json({
    success: true,
    message: "Account deleted successfully",
  });
});
