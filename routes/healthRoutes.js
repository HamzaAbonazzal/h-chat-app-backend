import express from "express";
import {
  quickHealth,
  fullHealth,
  readyHealth,
  liveHealth,
} from "../controllers/healthController.js";

const router = express.Router();

// ⭐ عام — بدون مصادقة (للـ Load Balancer)
router.get("/", quickHealth);
router.get("/full", fullHealth);
router.get("/ready", readyHealth);
router.get("/live", liveHealth);

export default router;
