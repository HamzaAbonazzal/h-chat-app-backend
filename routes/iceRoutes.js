import express from "express";
import { getIceServers } from "../controllers/iceController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/", getIceServers);

export default router;
