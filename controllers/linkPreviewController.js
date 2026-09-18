import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { extractFirstUrl, fetchLinkPreview } from "../utils/linkPreview.js";

// @route POST /api/link-preview
// Body: { url }
export const getLinkPreview = asyncHandler(async (req, res) => {
  const { url } = req.body;

  if (!url) {
    throw new ApiError(400, "url is required");
  }

  // ⭐ التحقق من صيغة URL
  let parsed;
  try {
    parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("Invalid protocol");
    }
  } catch {
    throw new ApiError(400, "Invalid URL");
  }

  const preview = await fetchLinkPreview(url);

  if (!preview) {
    return res.json({ success: true, data: null });
  }

  res.json({
    success: true,
    data: preview,
  });
});
