const validator = require('validator');
const DOMPurify = require('isomorphic-dompurify');

/**
 * Validates contact form data
 * @param {Object} data - The request body data
 * @returns {Object} Validation result
 */
function validateContactData(data) {
  const errors = [];
  
  if (!data || typeof data !== 'object') {
    return { isValid: false, errors: ['Invalid request data'] };
  }

  const { name, from, subject, body } = data;

  // Name validation
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    errors.push('Name must be at least 2 characters long');
  } else if (name.trim().length > 100) {
    errors.push('Name must be less than 100 characters');
  }

  // Email validation
  if (!from || typeof from !== 'string') {
    errors.push('Email is required');
  } else if (!validator.isEmail(from)) {
    errors.push('Please provide a valid email address');
  }

  // Subject validation
  if (!subject || typeof subject !== 'string' || subject.trim().length < 1) {
    errors.push('Subject is required');
  } else if (subject.trim().length > 200) {
    errors.push('Subject must be less than 200 characters');
  }

  // Message body validation
  if (!body || typeof body !== 'string' || body.trim().length < 10) {
    errors.push('Message must be at least 10 characters long');
  } else if (body.trim().length > 5000) {
    errors.push('Message must be less than 5000 characters');
  }

  // Check for suspicious patterns (basic spam detection)
  const suspiciousPatterns = [
    /https?:\/\/[^\s]+/gi, // Multiple URLs
    /\b(viagra|cialis|casino|lottery|winner)\b/gi, // Common spam words
  ];

  const combinedText = `${name} ${subject} ${body}`.toLowerCase();
  const urlMatches = combinedText.match(/https?:\/\/[^\s]+/gi);
  
  if (urlMatches && urlMatches.length > 2) {
    errors.push('Message contains too many links');
  }

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(combinedText)) {
      errors.push('Message content appears to be spam');
      break;
    }
  }

  return {
    isValid: errors.length === 0,
    errors: errors
  };
}

/**
 * Sanitizes input data to prevent XSS and other attacks
 * @param {Object} data - The request body data
 * @returns {Object} Sanitized data
 */
function sanitizeInput(data) {
  return {
    name: DOMPurify.sanitize(data.name.trim(), { ALLOWED_TAGS: [] }),
    from: validator.normalizeEmail(data.from.trim().toLowerCase()),
    subject: DOMPurify.sanitize(data.subject.trim(), { ALLOWED_TAGS: [] }),
    body: DOMPurify.sanitize(data.body.trim(), { ALLOWED_TAGS: [] })
  };
}

module.exports = { validateContactData, sanitizeInput };