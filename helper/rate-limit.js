function rateLimiting(options = {}) {
  options = Object.assign({
    windowMs: 60 * 1000, // milliseconds - how long to keep records of requests in memory
    max: 1, // max number of recent connections during `window` milliseconds before sending a 429 response
    message: "Too many requests, please try again later.",
    statusCode: 429, // 429 status = Too Many Requests (RFC 6585)
    headers: true, //Send custom rate limit header with limit and remaining
    skipFailedRequests: false, // Do not count failed requests (status >= 400)
    skipSuccessfulRequests: false, // Do not count successful requests (status < 400)
    // allows to create custom keys (by default user IP is used)
    // keyGenerator: function (req /*, res*/) {
    //   if (req.query.apiKey) return req.query.apiKey;
    //   return rateLimit.ipKeyGenerator(req.ip);
    // },
    // skip: function (/*req, res*/) {
    //   return false;
    // },
    handler: function (req, res /*, next*/) {
      res.status(429).send({ message: "Too many requests, please try again later.", });
    },
    // onLimitReached: function (/*req, res, optionsUsed*/) {},
  });
}

module.exports = {rateLimiting}