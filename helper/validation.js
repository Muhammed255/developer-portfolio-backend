const validator = require("validator");

// Control characters (incl. CR/LF) must never reach mail headers.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;
// Same, but keeps \n and \t, which are legitimate in a message body.
// eslint-disable-next-line no-control-regex
const BODY_CONTROL_CHARS = /[\u0000-\u0008\u000B-\u001F\u007F]/g;

const SPAM_WORDS = /\b(viagra|cialis|casino|lottery|winner)\b/i;
const URL_PATTERN = /https?:\/\/[^\s]+/gi;
const MAX_LINKS = 2;

/**
 * Validates contact form data
 * @param {Object} data - The request body data
 * @returns {Object} Validation result
 */
function validateContactData(data) {
  const errors = [];

  if (!data || typeof data !== "object") {
    return { isValid: false, errors: ["Invalid request data"] };
  }

  const { name, from, subject, body } = data;

  // Name validation
  if (!name || typeof name !== "string" || name.trim().length < 2) {
    errors.push("Name must be at least 2 characters long");
  } else if (name.trim().length > 100) {
    errors.push("Name must be less than 100 characters");
  } else if (/[<>"]/.test(name)) {
    errors.push("Name contains invalid characters");
  }

  // Email validation
  if (!from || typeof from !== "string") {
    errors.push("Email is required");
  } else if (from.length > 254 || !validator.isEmail(from.trim())) {
    errors.push("Please provide a valid email address");
  }

  // Subject validation
  if (!subject || typeof subject !== "string" || subject.trim().length < 1) {
    errors.push("Subject is required");
  } else if (subject.trim().length > 200) {
    errors.push("Subject must be less than 200 characters");
  }

  // Message body validation
  if (!body || typeof body !== "string" || body.trim().length < 10) {
    errors.push("Message must be at least 10 characters long");
  } else if (body.trim().length > 5000) {
    errors.push("Message must be less than 5000 characters");
  }

  if (errors.length === 0) {
    // Basic spam detection
    const combinedText = `${name} ${subject} ${body}`;
    const urlMatches = combinedText.match(URL_PATTERN);
    if (urlMatches && urlMatches.length > MAX_LINKS) {
      errors.push("Message contains too many links");
    }
    if (SPAM_WORDS.test(combinedText)) {
      errors.push("Message content appears to be spam");
    }
  }

  return {
    isValid: errors.length === 0,
    errors: errors,
  };
}

/**
 * Normalizes already-validated input. Values stay plain text: HTML escaping
 * happens only where the text is put into the HTML email (send-mail.js).
 * @param {Object} data - The request body data
 * @returns {Object} Sanitized data
 */
function sanitizeInput(data) {
  return {
    name: data.name.replace(CONTROL_CHARS, " ").trim(),
    from: data.from.trim(),
    subject: data.subject.replace(CONTROL_CHARS, " ").trim(),
    body: data.body.replace(BODY_CONTROL_CHARS, "").trim(),
  };
}

module.exports = { validateContactData, sanitizeInput };
