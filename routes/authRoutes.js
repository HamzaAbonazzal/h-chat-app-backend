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

// تسجيل مستخدم (Rate Limit صارم)
router.post(
  "/register",
  registerLimiter,
  [
    body("username")
      .trim()
      .isLength({ min: 3, max: 30 })
      .withMessage("Username must be 3-30 characters")
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage(
        "Username can only contain letters, numbers, and underscores",
      ),
    body("email").isEmail().normalizeEmail().withMessage("Invalid email"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters"),
  ],
  validate,
  register,
);

// تسجيل دخول (Rate Limit صارم)
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

// Refresh Token
router.post("/refresh", refresh);

// Logout
router.post("/logout", logout);

// البيانات الشخصية
router.get("/me", protect, getMe);

export default router;
