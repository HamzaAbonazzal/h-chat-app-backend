import express from "express";
import {
  createOrGetConversation,
  getUserConversations,
  getConversationById,
  updateGroup,
  addParticipant,
  removeParticipant,
  leaveGroup,
  deleteGroup,
  promoteToAdmin,
  demoteFromAdmin,
  updatePermissions,
  togglePinConversation,
  toggleMuteConversation,
  toggleArchiveConversation,
  deleteConversation,
  updateDisappearing,
} from "../controllers/conversationController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.route("/").post(createOrGetConversation).get(getUserConversations);

router
  .route("/:id")
  .get(getConversationById)
  .put(updateGroup)
  .delete(deleteConversation);

// ⭐ تنظيم المحادثة
router.put("/:id/pin", togglePinConversation);
router.put("/:id/mute", toggleMuteConversation);
router.put("/:id/archive", toggleArchiveConversation);

// ⭐ مغادرة وحذف
router.post("/:id/leave", leaveGroup);
router.delete("/:id/group", deleteGroup);

// ⭐ الأعضاء
router.post("/:id/participants", addParticipant);
router.delete("/:id/participants/:userId", removeParticipant);

// ⭐ الأدمن
router.post("/:id/admins", promoteToAdmin);
router.delete("/:id/admins/:userId", demoteFromAdmin);

// ⭐ الرسائل المؤقتة
router.put("/:id/disappearing", updateDisappearing);

// ⭐ الصلاحيات
router.put("/:id/permissions", updatePermissions);

export default router;
