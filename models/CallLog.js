import mongoose from "mongoose";

const callLogSchema = new mongoose.Schema(
  {
    caller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // ⭐ نوع المكالمة
    callType: {
      type: String,
      enum: ["voice", "video"],
      required: true,
    },
    // ⭐ الحالة
    status: {
      type: String,
      enum: ["missed", "answered", "rejected", "ended", "failed"],
      default: "missed",
      index: true,
    },
    // ⭐ متى بدأت
    startedAt: {
      type: Date,
      default: Date.now,
    },
    // ⭐ متى انتهت
    endedAt: {
      type: Date,
      default: null,
    },
    // ⭐ المدة بالثواني
    duration: {
      type: Number,
      default: 0,
    },
    // ⭐ من أنهى المكالمة
    endedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

// ⭐ فهرس لجلب سجل مستخدم بسرعة
callLogSchema.index({ caller: 1, createdAt: -1 });
callLogSchema.index({ receiver: 1, createdAt: -1 });

const CallLog = mongoose.model("CallLog", callLogSchema);
export default CallLog;
