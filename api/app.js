// server.js - Improved with best practices
const express = require("express");
const { sendMail } = require("../helper/send-mail");
const { validateContactData, sanitizeInput } = require("../helper/validation");
const { errorHandler, asyncHandler } = require("../helper/error-handling");
const app = express();
const port = process.env.PORT || 3000;
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet"); // Security middleware
const compression = require("compression"); // Gzip compression

// Security and performance middleware
app.use(helmet());
app.use(compression());

// Body parsing middleware with size limits
app.use(express.urlencoded({ extended: false, limit: "10mb" }));
app.use(express.json({ limit: "10mb" }));

// CORS configuration - more secure than allowing all origins
const corsOptions = {
  origin:
    process.env.NODE_ENV === "production"
      ? ["https://mohamed-abdelazim.netlify.app", "https://developer-portfolio-backend-eight.vercel.app"]
      : ["http://localhost:4200", "http://localhost:3000"],
  methods: ["POST"],
  allowedHeaders: ["Content-Type", "Accept"],
  credentials: false,
};
app.use(cors(corsOptions));

// Enhanced rate limiting
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Max 3 emails per 15 minutes per IP
  message: {
    error: "Too many contact form submissions. Please try again in 15 minutes.",
    retryAfter: 15 * 60, // seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error:
        "Too many contact form submissions. Please try again in 15 minutes.",
      retryAfter: 15 * 60,
    });
  },
  skip: (req) => {
    // Skip rate limiting in development
    return process.env.NODE_ENV === "development";
  },
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Contact form endpoint with improved validation and error handling
app.post(
  "/send-mail",
  contactLimiter,
  asyncHandler(async (req, res) => {
    // Validate and sanitize input
    const validationResult = validateContactData(req.body);
    if (!validationResult.isValid) {
      return res.status(400).json({
        error: "Validation failed",
        details: validationResult.errors,
      });
    }

    const { name, from, subject, body } = sanitizeInput(req.body);

    try {
      const result = await sendMail(from, subject, body, name);

      // Log successful email (without sensitive data)
      console.log(
        `Email sent successfully to ${
          process.env.MAIL_TO
        } from ${from} at ${new Date().toISOString()}`
      );

      res.status(200).json({
        message: "Message sent successfully",
        id: result.messageId || Date.now().toString(),
      });
    } catch (emailError) {
      console.error("Email sending failed:", emailError);
      res.status(500).json({
        error: "Failed to send email. Please try again later.",
      });
    }
  })
);

// 404 handler
app.use((error, req, res, next) => {
  console.log("eRRROR", error);
  res.status(404).json({ error: "Endpoint not found" });
  next();
});

// Global error handler
app.use(errorHandler);

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully");
  process.exit(0);
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});

module.exports = app;