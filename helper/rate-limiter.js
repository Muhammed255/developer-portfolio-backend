const { log } = require("./logger");

/**
 * In-memory counter. Only suitable for local development or a single
 * long-lived process: each serverless instance gets its own empty Map.
 */
class MemoryStore {
  constructor() {
    this.hits = new Map();
  }

  async increment(key, expiresAt) {
    const now = Date.now();
    for (const [k, entry] of this.hits) {
      if (entry.expiresAt <= now) this.hits.delete(k);
    }
    const entry = this.hits.get(key) || { count: 0, expiresAt };
    entry.count += 1;
    this.hits.set(key, entry);
    return entry.count;
  }
}

/**
 * DynamoDB counter shared by every Lambda instance. Items expire through the
 * table's TTL attribute `expiresAt` (epoch seconds).
 */
class DynamoStore {
  constructor(tableName) {
    const { DynamoDBClient, UpdateItemCommand } = require("@aws-sdk/client-dynamodb");
    this.client = new DynamoDBClient({});
    this.UpdateItemCommand = UpdateItemCommand;
    this.tableName = tableName;
  }

  async increment(key, expiresAt) {
    const result = await this.client.send(
      new this.UpdateItemCommand({
        TableName: this.tableName,
        Key: { pk: { S: key } },
        UpdateExpression: "ADD hits :one SET expiresAt = if_not_exists(expiresAt, :exp)",
        ExpressionAttributeValues: {
          ":one": { N: "1" },
          ":exp": { N: String(Math.ceil(expiresAt / 1000)) },
        },
        ReturnValues: "UPDATED_NEW",
      })
    );
    return Number(result.Attributes.hits.N);
  }
}

function createStore(tableName) {
  return tableName ? new DynamoStore(tableName) : new MemoryStore();
}

/**
 * Fixed-window rate limiter keyed by client IP.
 * Fails open: if the store is unavailable the request is allowed and the
 * error is logged, so a DynamoDB hiccup never breaks the contact form.
 */
function createRateLimiter({ windowMs, max, store, skip = () => false }) {
  return async (req, res, next) => {
    if (skip(req)) return next();

    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const expiresAt = windowStart + windowMs;
    const key = `${req.ip}#${windowStart}`;

    let count;
    try {
      count = await store.increment(key, expiresAt);
    } catch (error) {
      log("error", "rate limit store failed", { requestId: req.id, reason: error.message });
      return next();
    }

    const retryAfter = Math.ceil((expiresAt - now) / 1000);
    res.set("RateLimit-Limit", String(max));
    res.set("RateLimit-Remaining", String(Math.max(0, max - count)));
    res.set("RateLimit-Reset", String(retryAfter));

    if (count > max) {
      res.set("Retry-After", String(retryAfter));
      return res.status(429).json({
        error: "Too many contact form submissions. Please try again later.",
        retryAfter,
      });
    }
    next();
  };
}

module.exports = { createRateLimiter, createStore, MemoryStore };
