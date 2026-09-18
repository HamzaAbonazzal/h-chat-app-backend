import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    isGroup: {
      type: Boolean,
      default: false,
    },
    name: {
      type: String,
      trim: true,
      default: "",
    },
    groupAvatar: {
      type: String,
      default: "",
    },
    description: {
      type: String,
      default: "",
      maxlength: 500,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    admins: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    permissions: {
      sendMessages: {
        type: String,
        enum: ["all", "admins"],
        default: "all",
      },
      addMembers: {
        type: String,
        enum: ["all", "admins"],
        default: "all",
      },
      editGroupInfo: {
        type: String,
        enum: ["all", "admins"],
        default: "all",
      },
    },
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
    unreadCounts: {
      type: Map,
      of: Number,
      default: {},
    },
    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    pinnedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    mutedBy: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        until: {
          type: Date,
          default: null,
        },
        mutedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    archivedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    // ⭐ جديد: تاريخ مسح المحادثة لكل مستخدم
    clearedAt: {
      type: Map,
      of: Date,
      default: {},
    },
    // ⭐ جديد: الرسائل المثبتة
    pinnedMessages: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Message",
      },
    ],
    // ⭐ جديد: مدة الرسائل المؤقتة (بالثواني، 0 = إيقاف)
    disappearingDuration: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

const Conversation = mongoose.model("Conversation", conversationSchema);
export default Conversation;
