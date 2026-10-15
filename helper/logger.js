/**
 * Structured one-line JSON logs (CloudWatch / Vercel both index them).
 * Never pass email addresses or message content in `fields`.
 */
function log(level, message, fields = {}) {
  const line = JSON.stringify({ level, message, ...fields, time: new Date().toISOString() });
  if (level === "error") console.error(line);
  else console.log(line);
}

module.exports = { log };
