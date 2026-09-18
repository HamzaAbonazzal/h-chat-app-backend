import mongoose from "mongoose";

const blockSchema = new mongoose.Schema(
  {
    blocker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    blocked: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);

// منع التكرار: لا يمكن حظر نفس المستخدم مرتين
blockSchema.index({ blocker: 1, blocked: 1 }, { unique: true });

const Block = mongoose.model("Block", blockSchema);
export default Block;
