/**
 * Parses JSON bodies that arrive pre-buffered on `req.body`.
 *
 * On AWS Lambda, serverless-http hands Express a request that is already
 * marked as finished, with the raw payload as a Buffer on `req.body`.
 * express.json() (body-parser 2) treats finished requests as "already
 * parsed" and skips them, so routes would see a Buffer instead of an object.
 * This middleware parses that Buffer with the same limit and error types as
 * express.json(), so errorHandler maps them to 413 / 400 as usual.
 * Locally and on Vercel `req.body` is not a Buffer and this is a no-op.
 */
function bufferedJsonBody({ limit }) {
  return (req, res, next) => {
    if (!Buffer.isBuffer(req.body)) return next();

    const raw = req.body;
    req.body = {};

    if (raw.length > limit) {
      return next(Object.assign(new Error('request entity too large'), { type: 'entity.too.large', status: 413 }));
    }
    if (!raw.length || !req.is('application/json')) return next();

    try {
      req.body = JSON.parse(raw.toString('utf8'));
      next();
    } catch {
      next(Object.assign(new Error('invalid JSON'), { type: 'entity.parse.failed', status: 400 }));
    }
  };
}

module.exports = { bufferedJsonBody };
