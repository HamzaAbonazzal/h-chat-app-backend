import express from "express";
import { uploadFile, deleteFile } from "../controllers/uploadController.js";
import { upload } from "../middleware/uploadMiddleware.js";
import { protect } from "../middleware/authMiddleware.js";
import { uploadLimiter } from "../middleware/rateLimiters.js";

const router = express.Router();

router.use(protect);

// ⭐ رفع ملف
router.post("/", uploadLimiter, upload.single("file"), uploadFile);

// ⭐ حذف ملف من Cloudinary
router.delete("/:publicId", deleteFile);

export default router;
