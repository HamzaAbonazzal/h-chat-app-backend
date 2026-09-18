import express from "express";
import {
  blockUser,
  unblockUser,
  getBlockedUsers,
  checkBlockStatus,
} from "../controllers/blockController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.route("/").post(blockUser).get(getBlockedUsers);

router.get("/check/:userId", checkBlockStatus);
router.delete("/:userId", unblockUser);

export default router;
