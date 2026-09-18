import axios from "axios";
import * as cheerio from "cheerio";

const FETCH_TIMEOUT = 5000;
const MAX_REDIRECTS = 3;

// ⭐ نطاقات محظورة (SSRF protection)
const BLOCKED_HOSTS = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "169.254.",
  "10.",
  "172.16.",
  "172.17.",
  "172.18.",
  "172.19.",
  "172.20.",
  "172.21.",
  "172.22.",
  "172.23.",
  "172.24.",
  "172.25.",
  "172.26.",
  "172.27.",
  "172.28.",
  "172.29.",
  "172.30.",
  "172.31.",
  "192.168.",
];

const isBlockedHost = (hostname) => {
  return BLOCKED_HOSTS.some((host) => hostname.startsWith(host));
};

// ⭐ استخراج أول رابط من النص
export const extractFirstUrl = (text) => {
  if (!text) return null;

  const urlRegex = /(https?:\/\/[^\s<>"']+)/i;
  const match = text.match(urlRegex);
  return match ? match[1] : null;
};

// ⭐ استخراج OpenGraph + Meta tags
export const fetchLinkPreview = async (url) => {
  try {
    const parsed = new URL(url);

    if (isBlockedHost(parsed.hostname)) {
      throw new Error("Blocked host");
    }

    const response = await axios.get(url, {
      timeout: FETCH_TIMEOUT,
      maxRedirects: MAX_REDIRECTS,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; ChatAppBot/1.0; +https://example.com)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
      },
      validateStatus: (status) => status >= 200 && status < 400,
      maxContentLength: 2 * 1024 * 1024, // 2MB
      responseType: "text",
    });

    const html = response.data;
    const $ = cheerio.load(html);

    const getMeta = (property) =>
      $(`meta[property="${property}"]`).attr("content") ||
      $(`meta[name="${property}"]`).attr("content") ||
      "";

    let title =
      getMeta("og:title") ||
      getMeta("twitter:title") ||
      $("title").first().text().trim() ||
      "";

    let description =
      getMeta("og:description") ||
      getMeta("twitter:description") ||
      getMeta("description") ||
      "";

    let image =
      getMeta("og:image") ||
      getMeta("twitter:image") ||
      getMeta("twitter:image:src") ||
      "";

    const siteName =
      getMeta("og:site_name") || parsed.hostname.replace(/^www\./, "");

    // ⭐ تحويل الصورة النسبية إلى مطلقة
    if (image && !image.startsWith("http")) {
      try {
        image = new URL(image, url).href;
      } catch {
        image = "";
      }
    }

    // ⭐ تنظيف النصوص
    title = title.slice(0, 200).trim();
    description = description.slice(0, 300).trim();

    if (!title && !description) {
      return null;
    }

    return {
      url,
      title: title || parsed.hostname,
      description,
      image,
      siteName,
    };
  } catch (err) {
    console.error("Link preview error:", err.message);
    return null;
  }
};
