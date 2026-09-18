import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import {
  isCloudinaryEnabled,
  uploadBufferToCloudinary,
} from "../config/cloudinary.js";
import fs from "fs";

// @route POST /api/upload
export const uploadFile = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, "No file uploaded");

  let fileUrl;
  let fileData = {
    filename: "",
    mimetype: req.file.mimetype,
    size: req.file.size,
  };

  // ⭐ Cloudinary: نرفع من الـ buffer (أسرع + أكثر موثوقية)
  if (isCloudinaryEnabled()) {
    try {
      const buffer = req.file.buffer || fs.readFileSync(req.file.path);

      const resourceType = req.file.mimetype.startsWith("image/")
        ? "image"
        : req.file.mimetype.startsWith("video/") ||
            req.file.mimetype.startsWith("audio/")
          ? "video"
          : "raw";

      const uploadOptions = {
        resource_type: resourceType,
        public_id: `${Date.now()}-${Math.random()
          .toString(36)
          .substring(2, 10)}`,
      };

      // ⭐ تحويلات تلقائية للصور
      if (resourceType === "image") {
        uploadOptions.transformation = [
          {
            width: 1200,
            height: 1200,
            crop: "limit",
            quality: "auto:good",
            fetch_format: "auto",
          },
        ];
      }

      const result = await uploadBufferToCloudinary(buffer, uploadOptions);

      // ⭐ احذف الملف المؤقت إن وُجد
      if (req.file.path && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch {}
      }

      fileUrl = result.secure_url;
      fileData.filename = result.public_id;
      fileData.provider = "cloudinary";
      fileData.publicId = result.public_id;
      fileData.resourceType = result.resource_type;
      fileData.format = result.format || "";
      fileData.width = result.width || 0;
      fileData.height = result.height || 0;
      fileData.duration = result.duration || 0;
      fileData.bytes = result.bytes || req.file.size;
    } catch (err) {
      console.error("❌ Cloudinary upload failed:", err);

      // ⭐ معالجة الأخطاء بشكل واضح
      let message = "فشل الرفع إلى Cloudinary";

      if (err.http_code === 502 || err.message?.includes("502")) {
        message =
          "خدمة التخزين مشغولة. حاول مرة أخرى (قد يستغرق الرفع وقتاً للملفات الكبيرة).";
      } else if (err.http_code === 401 || err.http_code === 403) {
        message = "مشكلة في إعدادات Cloudinary (API Key/Secret).";
      } else if (err.message?.includes("timeout")) {
        message = "انتهت مدة الرفع. جرّب اتصالاً أسرع أو ملفاً أصغر.";
      } else if (err.message) {
        message = err.message;
      }

      throw new ApiError(500, message, "CLOUDINARY_UPLOAD_FAILED");
    }
  } else {
    // ⚠️ Local storage
    fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
    fileData.filename = req.file.filename;
    fileData.provider = "local";
  }

  res.status(201).json({
    success: true,
    data: {
      url: fileUrl,
      ...fileData,
    },
  });
});

// @route DELETE /api/upload/:publicId
export const deleteFile = asyncHandler(async (req, res) => {
  const { publicId } = req.params;
  const { resourceType = "image" } = req.query;

  if (!isCloudinaryEnabled()) {
    throw new ApiError(400, "Cloudinary is not configured");
  }

  const { cloudinary } = await import("../config/cloudinary.js");

  const result = await cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
  });

  if (result.result !== "ok" && result.result !== "not found") {
    throw new ApiError(400, "Failed to delete file");
  }

  res.json({ success: true, message: "File deleted" });
});
