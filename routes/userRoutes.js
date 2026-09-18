import express from "express";
import {
  getUsers,
  getUserById,
  updateProfile,
  updatePassword,
  getUsersStatus,
  getUserStatus,
  updatePrivacy,
} from "../controllers/userController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/", getUsers);

router.put("/profile", updateProfile);
router.put("/password", updatePassword);
router.put("/privacy", updatePrivacy);

router.post("/status", getUsersStatus);
router.get("/:id/status", getUserStatus);

router.get("/:id", getUserById);

export default router;
