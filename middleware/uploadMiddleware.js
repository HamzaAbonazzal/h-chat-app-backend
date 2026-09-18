import multer from "multer";
import path from "path";
import { isCloudinaryEnabled } from "../config/cloudinary.js";

// ⭐ فلتر الملفات
const fileFilter = (req, file, cb) => {
  const allowed =
    /jpeg|jpg|png|gif|webp|mp4|mov|avi|webm|mp3|wav|ogg|m4a|pdf|doc|docx/;
  const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  const mime = allowed.test(file.mimetype);

  if (ext && mime) cb(null, true);
  else cb(new Error("Unsupported file type"), false);
};

// ⭐ استخدام Memory Storage دائماً (نحن نرفع buffer لـ Cloudinary)
const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // ⭐ 100 MB (بدل 50)
  },
});
