import express from "express";
import { getLinkPreview } from "../controllers/linkPreviewController.js";
import { protect } from "../middleware/authMiddleware.js";
import { linkPreviewLimiter } from "../middleware/rateLimiters.js";

const router = express.Router();

router.use(protect);

router.post("/", linkPreviewLimiter, getLinkPreview);

export default router;
