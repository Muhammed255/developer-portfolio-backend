const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { getMailConfig, clearMailConfigCache } = require("../helper/mail-config");

const KEYS = ["MAIL_SECRET_ID", "MAIL_LOGIN_USER", "MAIL_LOGIN_PASS", "MAIL_TO", "MAIL_FROM", "MAIL_HOST", "MAIL_PORT"];

beforeEach(() => {
  for (const k of KEYS) delete process.env[k];
  clearMailConfigCache();
});

test("reads settings from environment variables with Brevo defaults", async () => {
  Object.assign(process.env, { MAIL_LOGIN_USER: "login@smtp.example", MAIL_LOGIN_PASS: "pw", MAIL_TO: "a@x.com, b@x.com" });
  const config = await getMailConfig();
  assert.deepEqual(config, {
    host: "smtp-relay.brevo.com",
    port: 465,
    user: "login@smtp.example",
    pass: "pw",
    from: "login@smtp.example",
    to: ["a@x.com", "b@x.com"],
  });
});

test("MAIL_FROM, MAIL_HOST and MAIL_PORT override the defaults", async () => {
  Object.assign(process.env, {
    MAIL_LOGIN_USER: "u", MAIL_LOGIN_PASS: "p", MAIL_TO: "a@x.com",
    MAIL_FROM: "me@x.com", MAIL_HOST: "smtp.gmail.com", MAIL_PORT: "587",
  });
  const config = await getMailConfig();
  assert.equal(config.from, "me@x.com");
  assert.equal(config.host, "smtp.gmail.com");
  assert.equal(config.port, 587);
});

test("missing settings are reported by name", async () => {
  process.env.MAIL_LOGIN_USER = "u";
  await assert.rejects(getMailConfig(), /Missing mail settings: MAIL_LOGIN_PASS, MAIL_TO/);
});
