import CallLog from "../models/CallLog.js";
import User from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// @route GET /api/calls?page=&limit=
// جلب سجل المكالمات للمستخدم
export const getCallLogs = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 30;
  const skip = (page - 1) * limit;

  // ⭐ المكالمات الصادرة والواردة
  const query = {
    $or: [{ caller: userId }, { receiver: userId }],
  };

  const total = await CallLog.countDocuments(query);

  const calls = await CallLog.find(query)
    .populate("caller", "username avatar")
    .populate("receiver", "username avatar")
    .populate("endedBy", "username")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  // ⭐ تحديد الاتجاه لكل مكالمة
  const formatted = calls.map((call) => {
    const obj = call.toObject();
    obj.direction =
      call.caller._id.toString() === userId.toString()
        ? "outgoing"
        : "incoming";
    return obj;
  });

  res.json({
    success: true,
    data: formatted,
    pagination: {
      page,
      limit,
      total,
      hasMore: skip + calls.length < total,
    },
  });
});

// @route DELETE /api/calls/:id
// حذف مكالمة من السجل
export const deleteCallLog = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const call = await CallLog.findById(id);
  if (!call) throw new ApiError(404, "Call log not found");

  // ⭐ فقط من كان طرفاً في المكالمة يمكنه حذفها
  const isParticipant =
    call.caller.toString() === userId.toString() ||
    call.receiver.toString() === userId.toString();

  if (!isParticipant) {
    throw new ApiError(403, "Not authorized");
  }

  await CallLog.findByIdAndDelete(id);

  res.json({ success: true, message: "Call log deleted" });
});

// @route DELETE /api/calls
// حذف كل السجل
export const clearCallLogs = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  await CallLog.deleteMany({
    $or: [{ caller: userId }, { receiver: userId }],
  });

  res.json({ success: true, message: "Call logs cleared" });
});
