import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      default: null,
    },
    type: {
      type: String,
      enum: ["text", "image", "video", "audio", "file", "system"],
      default: "text",
    },
    content: {
      type: String,
      default: "",
    },
    mediaUrl: {
      type: String,
      default: "",
    },
    duration: {
      type: Number,
      default: 0,
    },
    deliveredTo: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    editedAt: {
      type: Date,
      default: null,
    },
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    forwardedFrom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reactions: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        emoji: {
          type: String,
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    systemMessage: {
      action: {
        type: String,
        enum: [
          "group_created",
          "user_added",
          "user_left",
          "user_removed",
          "admin_promoted",
          "admin_demoted",
          "group_name_changed",
          "group_photo_changed",
          "group_description_changed",
          "permissions_changed",
          "disappearing_changed",
          "message_pinned",
          "message_unpinned",
        ],
      },
      // ...
      actor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      target: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
    },
    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    linkPreview: {
      url: { type: String, default: "" },
      title: { type: String, default: "" },
      description: { type: String, default: "" },
      image: { type: String, default: "" },
      siteName: { type: String, default: "" },
    },
    // ⭐ جديد: من حفظ الرسالة
    starredBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true },
);

messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });
messageSchema.index({ replyTo: 1 });
messageSchema.index({ deletedFor: 1 });
messageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// ⭐ فهرس للبحث السريع في المحفوظات
messageSchema.index({ starredBy: 1 });

const Message = mongoose.model("Message", messageSchema);
export default Message;
