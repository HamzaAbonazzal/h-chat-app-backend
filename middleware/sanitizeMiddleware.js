import xss from "xss";

/**
 * ⭐ تعقيم NoSQL Injection يدوياً (بديل لـ express-mongo-sanitize)
 * يزيل أي مفتاح يبدأ بـ $ أو يحتوي على .
 */
const sanitizeNoSQL = (obj) => {
  if (!obj || typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    obj.forEach((item) => sanitizeNoSQL(item));
    return obj;
  }

  for (const key of Object.keys(obj)) {
    if (key.startsWith("$") || key.includes(".")) {
      delete obj[key];
    } else if (typeof obj[key] === "object" && obj[key] !== null) {
      sanitizeNoSQL(obj[key]);
    }
  }

  return obj;
};

/**
 * Middleware: يمنع NoSQL Injection في body و params.
 * (query غير قابل للتعديل في Express 5، لذا نتحقق منه يدوياً)
 */
export const noSQLSanitizer = (req, res, next) => {
  try {
    if (req.body && typeof req.body === "object") {
      sanitizeNoSQL(req.body);
    }

    if (req.params && typeof req.params === "object") {
      sanitizeNoSQL(req.params);
    }

    // فحص query (قراءة فقط في Express 5)
    if (req.query) {
      const queryStr = JSON.stringify(req.query);
      if (queryStr.includes("$") || queryStr.includes('".')) {
        return res.status(400).json({
          success: false,
          message: "Invalid query parameters",
        });
      }
    }
  } catch (err) {
    console.error("noSQLSanitizer error:", err.message);
  }

  next();
};

// ============ XSS Sanitizer ============

const xssOptions = {
  whiteList: {},
  stripIgnoreTag: true,
  stripIgnoreTagBody: ["script"],
};

const sanitizeValue = (value) => {
  if (typeof value === "string") {
    return xss(value, xssOptions);
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value && typeof value === "object") {
    return sanitizeObject(value);
  }
  return value;
};

const sanitizeObject = (obj) => {
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      obj[key] = sanitizeValue(obj[key]);
    }
  }
  return obj;
};

export const xssSanitizer = (req, res, next) => {
  try {
    if (req.body && typeof req.body === "object") {
      sanitizeObject(req.body);
    }
  } catch (err) {
    console.error("xssSanitizer error:", err.message);
  }
  next();
};
