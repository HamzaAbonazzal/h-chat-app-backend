import express from "express";
import {
  sendMessage,
  forwardMessage,
  getMessages,
  getMessageContext,
  searchMessagesInConversation,
  searchAllMessages,
  getStarredMessages,
  getPinnedMessages,
  editMessage,
  toggleReaction,
  toggleStar,
  togglePinMessage,
  getMessageInfo,
  clearConversationMessages,
  markAsDelivered,
  markAsRead,
  markConversationAsRead,
  deleteMessage,
} from "../controllers/messageController.js";
import { protect } from "../middleware/authMiddleware.js";
import { messageLimiter } from "../middleware/rateLimiters.js";

const router = express.Router();

router.use(protect);

router.post("/", messageLimiter, sendMessage);
router.post("/forward", messageLimiter, forwardMessage);

router.post("/delivered", markAsDelivered);
router.post("/read", markAsRead);

// ⭐ مسارات ثابتة
router.get("/search/all", searchAllMessages);
router.get("/starred", getStarredMessages);
router.delete("/conversation/:conversationId/clear", clearConversationMessages);
router.get("/:conversationId/search", searchMessagesInConversation);
router.get("/:conversationId/pinned", getPinnedMessages);
router.put("/:conversationId/read-all", markConversationAsRead);

// ⭐ سياق رسالة
router.get("/:id/context", getMessageContext);
router.get("/:id/info", getMessageInfo);

router.get("/:conversationId", getMessages);

router.post("/:id/reactions", toggleReaction);
router.put("/:id/star", toggleStar);
router.put("/:id/pin", togglePinMessage);

router.put("/:id", editMessage);
router.delete("/:id", deleteMessage);

export default router;
