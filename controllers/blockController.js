import Block from "../models/Block.js";
import User from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// @route POST /api/blocks
// Body: { userId }
export const blockUser = asyncHandler(async (req, res) => {
  const { userId } = req.body;
  const myId = req.user._id;

  if (!userId) throw new ApiError(400, "userId is required");
  if (userId.toString() === myId.toString())
    throw new ApiError(400, "You cannot block yourself");

  const targetUser = await User.findById(userId);
  if (!targetUser) throw new ApiError(404, "User not found");

  // فحص إذا كان محظوراً بالفعل
  const existing = await Block.findOne({
    blocker: myId,
    blocked: userId,
  });

  if (existing) {
    return res.json({
      success: true,
      message: "User already blocked",
      data: existing,
    });
  }

  const block = await Block.create({
    blocker: myId,
    blocked: userId,
  });

  res.status(201).json({
    success: true,
    message: "User blocked",
    data: block,
  });
});

// @route DELETE /api/blocks/:userId
export const unblockUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const myId = req.user._id;

  const result = await Block.findOneAndDelete({
    blocker: myId,
    blocked: userId,
  });

  if (!result) {
    throw new ApiError(404, "User is not blocked");
  }

  res.json({
    success: true,
    message: "User unblocked",
  });
});

// @route GET /api/blocks
export const getBlockedUsers = asyncHandler(async (req, res) => {
  const blocks = await Block.find({ blocker: req.user._id })
    .populate("blocked", "username avatar bio isOnline lastSeen isDeleted")
    .sort({ createdAt: -1 });

  const data = blocks.map((b) => ({
    blockedAt: b.createdAt,
    user: b.blocked,
  }));

  res.json({ success: true, data });
});

// @route GET /api/blocks/check/:userId
export const checkBlockStatus = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const myId = req.user._id;

  const iBlockedThem = await Block.findOne({
    blocker: myId,
    blocked: userId,
  });

  const theyBlockedMe = await Block.findOne({
    blocker: userId,
    blocked: myId,
  });

  res.json({
    success: true,
    data: {
      iBlockedThem: !!iBlockedThem,
      theyBlockedMe: !!theyBlockedMe,
      isBlocked: !!(iBlockedThem || theyBlockedMe),
    },
  });
});
