import User from "../models/User.js";
import Block from "../models/Block.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  getUserContacts,
  buildPresenceResponse,
  buildUserResponse,
} from "../utils/presenceHelper.js";

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
