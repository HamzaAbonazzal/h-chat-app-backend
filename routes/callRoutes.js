import express from "express";
import {
  getCallLogs,
  deleteCallLog,
  clearCallLogs,
} from "../controllers/callController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.route("/").get(getCallLogs).delete(clearCallLogs);

router.delete("/:id", deleteCallLog);

export default router;
