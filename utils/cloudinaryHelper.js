import { isCloudinaryEnabled } from "../config/cloudinary.js";

/**
 * استخراج public_id من Cloudinary URL
 * مثال: https://res.cloudinary.com/xxx/image/upload/v123/chat-app/abc.jpg
 * → "chat-app/abc"
 */
export const extractPublicId = (url) => {
  if (!url || !url.includes("cloudinary.com")) return null;

  try {
    const urlParts = url.split("/");
    const uploadIndex = urlParts.indexOf("upload");
    if (uploadIndex === -1) return null;

    // الجزء بعد "upload/vXXX/..."
    const afterUpload = urlParts.slice(uploadIndex + 1);

    // احذف "vXXX" إن وُجد
    if (afterUpload[0]?.startsWith("v")) {
      afterUpload.shift();
    }

    const publicIdWithExt = afterUpload.join("/");
    // احذف الامتداد
    return publicIdWithExt.replace(/\.[^/.]+$/, "");
  } catch {
    return null;
  }
};

/**
 * استخراج resource_type من Cloudinary URL
 */
export const extractResourceType = (url) => {
  if (!url || !url.includes("cloudinary.com")) return "image";

  if (url.includes("/video/upload/")) return "video";
  if (url.includes("/raw/upload/")) return "raw";
  return "image";
};

/**
 * حذف ملف من Cloudinary (بأمان — بدون رمي أخطاء)
 */
export const deleteCloudinaryFile = async (url) => {
  if (!isCloudinaryEnabled() || !url) return false;

  const publicId = extractPublicId(url);
  if (!publicId) return false;

  try {
    const { cloudinary } = await import("../config/cloudinary.js");
    const resourceType = extractResourceType(url);

    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });

    console.log(`🗑️ Deleted from Cloudinary: ${publicId} (${resourceType})`);
    return result.result === "ok";
  } catch (err) {
    console.warn("⚠️ Failed to delete from Cloudinary:", err.message);
    return false;
  }
};
