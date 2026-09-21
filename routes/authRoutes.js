import express from "express";
import { body } from "express-validator";
import {
  register,
  login,
  logout,
  refresh,
  getMe,
} from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validateMiddleware.js";
import { authLimiter, registerLimiter } from "../middleware/rateLimiters.js";

const router = express.Router();

// ⭐ regex يقبل: العربية، الإنجليزية، الأرقام، والشرطة السفلية
// المدى العربي: \u0600-\u06FF (Arabic), \u0750-\u077F (Arabic Supplement)
const USERNAME_REGEX = /^[\u0600-\u06FF\u0750-\u077Fa-zA-Z0-9_ ]+$/;

router.post(
  "/register",
  registerLimiter,
  [
    body("username")
      .trim()
      .isLength({ min: 3, max: 30 })
      .withMessage("Username must be 3-30 characters")
      .matches(USERNAME_REGEX)
      .withMessage(
        "Username can only contain Arabic or English letters, numbers, and underscores",
      ),
    body("email").isEmail().normalizeEmail().withMessage("Invalid email"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters"),
  ],
  validate,
  register,
);

router.post(
  "/login",
  authLimiter,
  [
    body("email").isEmail().withMessage("Invalid email"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  validate,
  login,
);

router.post("/refresh", refresh);
router.post("/logout", logout);
router.get("/me", protect, getMe);

export default router;
