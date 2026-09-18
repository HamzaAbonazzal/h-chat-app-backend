import express from "express";
import {
  registerToken,
  unregisterToken,
  sendTestNotification,
} from "../controllers/notificationController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.post("/register-token", registerToken);
router.delete("/unregister-token", unregisterToken);
router.post("/test", sendTestNotification);

export default router;
