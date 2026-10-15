const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { randomUUID } = require("node:crypto");
const { sendMail } = require("../helper/send-mail");
const { validateContactData, sanitizeInput } = require("../helper/validation");
const { errorHandler, notFoundHandler, asyncHandler } = require("../helper/error-handling");
const { createRateLimiter, createStore } = require("../helper/rate-limiter");
const { log } = require("../helper/logger");
const { bufferedJsonBody } = require("../helper/buffered-body");

const BODY_LIMIT = 16 * 1024;

const app = express();

// One proxy hop (Vercel edge / API Gateway) sits in front of the app, so the
// client IP is the last entry it appends to X-Forwarded-For.
app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(helmet());
app.use(bufferedJsonBody({ limit: BODY_LIMIT })); // Lambda (serverless-http)
app.use(express.json({ limit: BODY_LIMIT }));

// Allowed origins come from CORS_ORIGINS (comma-separated) so a new frontend
// host doesn't need a code change.
const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:4200")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Accept"],
    credentials: false,
    maxAge: 600,
  })
);

app.use((req, res, next) => {
  req.id = req.get("x-amzn-trace-id") || req.get("x-vercel-id") || randomUUID();
  next();
});

const contactLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 3,
  store: createStore(process.env.RATE_LIMIT_TABLE),
  skip: () => process.env.NODE_ENV === "development",
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", timestamp: new Date().toISOString() });
});

app.post(
  "/send-mail",
  contactLimiter,
  asyncHandler(async (req, res) => {
    // Honeypot: real users never see the "website" field, bots fill it in.
    // Pretend success so the bot doesn't retry.
    if (req.body && req.body.website) {
      log("info", "honeypot triggered", { requestId: req.id });
      return res.status(200).json({ message: "Message sent successfully" });
    }

    const validationResult = validateContactData(req.body);
    if (!validationResult.isValid) {
      return res.status(400).json({
        error: "Validation failed",
        details: validationResult.errors,
      });
    }

    const { name, from, subject, body } = sanitizeInput(req.body);

    try {
      await sendMail({ from, subject, body, name });
      log("info", "contact email sent", { requestId: req.id });
      res.status(200).json({ message: "Message sent successfully" });
    } catch (error) {
      log("error", "contact email failed", { requestId: req.id, reason: error.message });
      res.status(502).json({ error: "Failed to send email. Please try again later." });
    }
  })
);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
