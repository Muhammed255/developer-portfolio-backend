const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const request = require("supertest");

process.env.CORS_ORIGINS = "https://allowed.example";
delete process.env.RATE_LIMIT_TABLE;
delete process.env.NODE_ENV;

// Replace the mailer before the app loads so no real SMTP call is made.
const sent = [];
const sendMailPath = path.join(__dirname, "..", "helper", "send-mail.js");
require.cache[sendMailPath] = {
  id: sendMailPath,
  filename: sendMailPath,
  loaded: true,
  exports: { sendMail: async (message) => sent.push(message) },
};

const app = require("../src/app");

const validBody = {
  name: "Jane Doe",
  from: "jane+portfolio@gmail.com",
  subject: "Hello there",
  body: "I'd like to talk about a project: https://example.com/brief",
};

// Each test gets its own client IP so the rate limiter doesn't interfere.
let ipCounter = 0;
const post = (body) =>
  request(app)
    .post("/send-mail")
    .set("X-Forwarded-For", `10.0.0.${++ipCounter}`)
    .send(body);

beforeEach(() => {
  sent.length = 0;
});

test("GET /health returns OK", async () => {
  const res = await request(app).get("/health");
  assert.equal(res.status, 200);
  assert.equal(res.body.status, "OK");
});

test("unknown route returns JSON 404", async () => {
  const res = await request(app).get("/nope");
  assert.equal(res.status, 404);
  assert.deepEqual(res.body, { error: "Endpoint not found" });
});

test("malformed JSON returns 400, not 404", async () => {
  const res = await request(app)
    .post("/send-mail")
    .set("Content-Type", "application/json")
    .send("{bad");
  assert.equal(res.status, 400);
  assert.equal(res.body.error, "Malformed JSON body");
});

test("oversized body returns 413", async () => {
  const res = await post({ ...validBody, body: "x".repeat(20 * 1024) });
  assert.equal(res.status, 413);
});

test("CORS preflight allows configured origin only", async () => {
  const allowed = await request(app)
    .options("/send-mail")
    .set("Origin", "https://allowed.example")
    .set("Access-Control-Request-Method", "POST");
  assert.equal(allowed.headers["access-control-allow-origin"], "https://allowed.example");

  const denied = await request(app)
    .options("/send-mail")
    .set("Origin", "https://evil.example")
    .set("Access-Control-Request-Method", "POST");
  assert.equal(denied.headers["access-control-allow-origin"], undefined);
});

test("valid message is sent with the email kept as typed and one link allowed", async () => {
  const res = await post(validBody);
  assert.equal(res.status, 200);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].from, "jane+portfolio@gmail.com");
  assert.equal(sent[0].body, validBody.body);
});

test("message text is not HTML-encoded before sending", async () => {
  const res = await post({ ...validBody, body: "Use the <div> tag & see 5 > 3" });
  assert.equal(res.status, 200);
  assert.equal(sent[0].body, "Use the <div> tag & see 5 > 3");
});

test("CR/LF is stripped from header fields", async () => {
  const res = await post({ ...validBody, subject: "Hi\r\nBcc: victim@example.com" });
  assert.equal(res.status, 200);
  assert.ok(!/[\r\n]/.test(sent[0].subject));
});

test("name with angle brackets or quotes is rejected", async () => {
  const res = await post({ ...validBody, name: 'Eve" <eve@evil.com>' });
  assert.equal(res.status, 400);
  assert.equal(sent.length, 0);
});

test("invalid fields return 400 with details", async () => {
  const res = await post({ name: "J", from: "nope", subject: "", body: "short" });
  assert.equal(res.status, 400);
  assert.equal(res.body.details.length, 4);
});

test("more than two links is rejected", async () => {
  const res = await post({ ...validBody, body: "http://a.com http://b.com http://c.com spam" });
  assert.equal(res.status, 400);
});

test("honeypot submission returns 200 without sending", async () => {
  const res = await post({ ...validBody, website: "http://bot.example" });
  assert.equal(res.status, 200);
  assert.equal(sent.length, 0);
});

test("fourth request from the same IP within the window gets 429", async () => {
  const ip = "10.9.9.9";
  const send = () => request(app).post("/send-mail").set("X-Forwarded-For", ip).send(validBody);
  for (let i = 0; i < 3; i++) assert.equal((await send()).status, 200);
  const res = await send();
  assert.equal(res.status, 429);
  assert.ok(res.headers["retry-after"]);
});
