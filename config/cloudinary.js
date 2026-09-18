import { v2 as cloudinary } from "cloudinary";

// ⭐ التهيئة مع timeout أطول
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
  timeout: 180000, // ⭐ 3 دقائق (بدل 60 ثانية)
});

export const initCloudinary = () => {
  const { cloud_name, api_key, api_secret } = cloudinary.config();

  if (!cloud_name || !api_key || !api_secret) {
    console.warn(
      "⚠️  Cloudinary not configured. Media uploads will use local storage.",
    );
    return false;
  }

  console.log(`✅ Cloudinary initialized: ${cloud_name}`);
  return true;
};

export const isCloudinaryEnabled = () => {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
};

/**
 * ⭐ رفع ملف إلى Cloudinary مع retry
 */
export const uploadToCloudinary = async (
  filePath,
  options = {},
  retries = 2,
) => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await cloudinary.uploader.upload(filePath, {
        folder: "chat-app",
        resource_type: "auto",
        timeout: 180000,
        ...options,
      });
      return result;
    } catch (err) {
      console.warn(
        `⚠️ Cloudinary upload attempt ${attempt + 1} failed:`,
        err.message,
      );

      if (attempt === retries) {
        throw err;
      }

      // ⭐ انتظر قبل المحاولة التالية
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
};

/**
 * ⭐ رفع buffer مباشر (بدون ملف مؤقت)
 */
export const uploadBufferToCloudinary = async (
  buffer,
  options = {},
  retries = 2,
) => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: "chat-app",
            resource_type: "auto",
            timeout: 180000,
            ...options,
          },
          (err, result) => {
            if (err) return reject(err);
            resolve(result);
          },
        );
        uploadStream.end(buffer);
      });
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
};

export { cloudinary };
export default cloudinary;
