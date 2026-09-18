import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// ⭐ تخزين مؤقت للـ credentials (لتجنب طلبها في كل مرة)
let cachedTurnData = null;
let cacheExpiresAt = 0;
const CACHE_DURATION = 12 * 60 * 60 * 1000; // 12 ساعة

// ⭐ جلب TURN credentials من Metered
const fetchMeteredCredentials = async () => {
  const appName = process.env.METERED_APP_NAME;
  const apiKey = process.env.METERED_API_KEY;

  if (!appName || !apiKey) {
    console.warn(
      "⚠️ Metered not configured (METERED_APP_NAME/METERED_API_KEY missing)",
    );
    return null;
  }

  try {
    const url = `https://${appName}.metered.live/api/v1/turn/credentials?apiKey=${apiKey}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Metered API error: ${response.status}`);
    }

    const data = await response.json();
    return data; // مصفوفة من ICE servers
  } catch (err) {
    console.error("Failed to fetch Metered credentials:", err.message);
    return null;
  }
};

// @route GET /api/ice-servers
export const getIceServers = asyncHandler(async (req, res) => {
  // ⭐ STUN Servers (مجانية، دائماً)
  const stunUrls = (
    process.env.STUN_URLS ||
    "stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302,stun:stun.cloudflare.com:3478"
  )
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);

  let iceServers = [];

  // ⭐ الطريقة 1: جلب من Metered API (الأفضل)
  const now = Date.now();

  if (now < cacheExpiresAt && cachedTurnData) {
    // استخدم المخزّن مؤقتاً
    iceServers = cachedTurnData;
  } else {
    // اجلب من Metered
    const meteredData = await fetchMeteredCredentials();

    if (meteredData && Array.isArray(meteredData)) {
      iceServers = meteredData;
      cachedTurnData = meteredData;
      cacheExpiresAt = now + CACHE_DURATION;
    }
  }

  // ⭐ الطريقة 2 (Fallback): استخدام credentials ثابتة من .env
  if (iceServers.length === 0) {
    const turnUrl = process.env.TURN_URL;
    const turnTlsUrl = process.env.TURN_TLS_URL;
    const turnUsername = process.env.TURN_USERNAME;
    const turnCredential = process.env.TURN_CREDENTIAL;

    // ⭐ أضف STUN
    iceServers.push({ urls: stunUrls });

    // ⭐ أضف TURN إذا متاح
    if (turnUrl && turnUsername && turnCredential) {
      iceServers.push({
        urls: turnUrl,
        username: turnUsername,
        credential: turnCredential,
      });
    }

    if (turnTlsUrl && turnUsername && turnCredential) {
      iceServers.push({
        urls: turnTlsUrl,
        username: turnUsername,
        credential: turnCredential,
      });
    }
  } else {
    // ⭐ تأكد من وجود STUN مع TURN
    const hasStun = iceServers.some((server) =>
      (Array.isArray(server.urls) ? server.urls : [server.urls]).some((u) =>
        u.startsWith("stun:"),
      ),
    );

    if (!hasStun) {
      iceServers.unshift({ urls: stunUrls });
    }
  }

  // ⭐ حساب عدد المزودين
  const turnCount = iceServers.filter((server) => {
    const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
    return urls.some((u) => u.startsWith("turn:") || u.startsWith("turns:"));
  }).length;

  const stunCount = iceServers.filter((server) => {
    const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
    return urls.some((u) => u.startsWith("stun:"));
  }).length;

  res.json({
    success: true,
    data: {
      iceServers,
      hasTurn: turnCount > 0,
      providers: {
        stun: stunCount,
        turn: turnCount,
      },
    },
  });
});
