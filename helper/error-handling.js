const { log } = require("./logger");

/**
 * Async error handler wrapper
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Express middleware
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Catch-all for unknown routes. Must be registered after all routes and
 * before errorHandler. Three arguments, so Express treats it as a normal
 * middleware rather than an error handler.
 */
function notFoundHandler(req, res) {
  res.status(404).json({ error: "Endpoint not found" });
}

/**
 * Global error handler middleware
 * @param {Error} error - The error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(error, req, res, next) {
  // Errors raised by express.json(): malformed body, oversized body, etc.
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Malformed JSON body" });
  }
  if (error.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body too large" });
  }

  const statusCode = error.statusCode || error.status || 500;
  log("error", "unhandled error", {
    requestId: req.id,
    statusCode,
    reason: error.message,
  });

  // Don't expose internal errors outside development
  const isDevelopment = process.env.NODE_ENV === "development";
  res.status(statusCode).json({
    error: isDevelopment ? error.message : "Internal server error",
    ...(isDevelopment && { stack: error.stack }),
  });
}

module.exports = { asyncHandler, notFoundHandler, errorHandler };
