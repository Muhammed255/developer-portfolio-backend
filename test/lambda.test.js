// Runs requests through the real Lambda entry point (serverless-http) with
// API Gateway HTTP API (payload v2) events. Regression test for JSON bodies
// being skipped by express.json() on Lambda.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

process.env.CORS_ORIGINS = "https://allowed.example";
delete process.env.RATE_LIMIT_TABLE;
delete process.env.NODE_ENV;

const sent = [];
const sendMailPath = path.join(__dirname, "..", "helper", "send-mail.js");
require.cache[sendMailPath] = {
  id: sendMailPath,
  filename: sendMailPath,
  loaded: true,
  exports: { sendMail: async (message) => sent.push(message) },
};

const { handler } = require("../src/lambda");

let ip = 0;
function invoke(body, { base64 = false, contentType = "application/json" } = {}) {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  return handler(
    {
      version: "2.0",
      routeKey: "$default",
      rawPath: "/send-mail",
      rawQueryString: "",
      headers: { "content-type": contentType, host: "api.example", "x-forwarded-for": `10.1.0.${++ip}` },
      requestContext: { http: { method: "POST", path: "/send-mail", sourceIp: `10.1.0.${ip}` } },
      body: base64 ? Buffer.from(raw).toString("base64") : raw,
      isBase64Encoded: base64,
    },
    {}
  );
}

const validBody = {
  name: "Jane Doe",
  from: "jane@example.com",
  subject: "Hello",
  body: "This is a message sent through the Lambda handler.",
};

test("Lambda: valid JSON body reaches the route and sends mail", async () => {
  sent.length = 0;
  const res = await invoke(validBody);
  assert.equal(res.statusCode, 200, res.body);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].name, "Jane Doe");
});

test("Lambda: base64-encoded body is handled", async () => {
  sent.length = 0;
  const res = await invoke(validBody, { base64: true });
  assert.equal(res.statusCode, 200, res.body);
  assert.equal(sent.length, 1);
});

test("Lambda: honeypot returns 200 without sending", async () => {
  sent.length = 0;
  const res = await invoke({ ...validBody, website: "http://spam.example" });
  assert.equal(res.statusCode, 200, res.body);
  assert.equal(sent.length, 0);
});

test("Lambda: malformed JSON returns 400", async () => {
  const res = await invoke("{bad");
  assert.equal(res.statusCode, 400);
  assert.match(res.body, /Malformed JSON/);
});

test("Lambda: oversized body returns 413", async () => {
  const res = await invoke({ ...validBody, body: "x".repeat(20 * 1024) });
  assert.equal(res.statusCode, 413);
});
