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
 * Global error handler middleware
 * @param {Error} error - The error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function errorHandler(error, req, res, next) {
  console.error('Global error handler:', error);
  
  // Don't expose internal errors in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  let statusCode = error.statusCode || 500;
  let message = 'Internal server error';
  
  if (isDevelopment) {
    message = error.message || message;
  }
  
  // Handle specific error types
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation error';
  }

  console.log("HEHEHREHHRHEH",{
    error: message,
    ...(isDevelopment && { stack: error.stack })
  })
  
  res.status(statusCode).json({
    error: message,
    ...(isDevelopment && { stack: error.stack })
  });
}

module.exports = { asyncHandler, errorHandler };