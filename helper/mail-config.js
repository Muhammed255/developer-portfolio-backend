/**
 * SMTP settings for the contact mailer.
 *
 * - On AWS, MAIL_SECRET_ID names a Secrets Manager secret holding a JSON
 *   object with MAIL_LOGIN_USER, MAIL_LOGIN_PASS, MAIL_TO and optionally
 *   MAIL_FROM (verified sender; defaults to the login), MAIL_HOST and
 *   MAIL_PORT. It is read at runtime and cached for a few minutes, so
 *   updating the secret takes effect without a redeploy and the password
 *   never appears in the Lambda configuration.
 * - Locally / on Vercel the same keys come from environment variables.
 */
const REQUIRED_KEYS = ["MAIL_LOGIN_USER", "MAIL_LOGIN_PASS", "MAIL_TO"];
const CACHE_MS = 5 * 60 * 1000;

let cached = null; // { config, expiresAt }

async function loadSource() {
  const secretId = process.env.MAIL_SECRET_ID;
  if (!secretId) return process.env;

  const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
  const client = new SecretsManagerClient({});
  const { SecretString } = await client.send(new GetSecretValueCommand({ SecretId: secretId }));
  return JSON.parse(SecretString || "{}");
}

async function getMailConfig() {
  if (cached && cached.expiresAt > Date.now()) return cached.config;

  const source = await loadSource();
  const missing = REQUIRED_KEYS.filter((key) => !source[key]);
  if (missing.length > 0) {
    throw new Error(`Missing mail settings: ${missing.join(", ")}`);
  }

  const config = {
    host: source.MAIL_HOST || "smtp-relay.brevo.com",
    port: Number(source.MAIL_PORT || 465),
    user: source.MAIL_LOGIN_USER,
    pass: source.MAIL_LOGIN_PASS,
    from: source.MAIL_FROM || source.MAIL_LOGIN_USER,
    to: source.MAIL_TO.split(",").map((email) => email.trim()).filter(Boolean),
  };
  cached = { config, expiresAt: Date.now() + CACHE_MS };
  return config;
}

/** For tests. */
function clearMailConfigCache() {
  cached = null;
}

module.exports = { getMailConfig, clearMailConfigCache };
