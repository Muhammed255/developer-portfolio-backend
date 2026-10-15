// AWS Lambda entry point (API Gateway HTTP API, payload format 2.0).
const serverless = require("serverless-http");
const app = require("./app");

module.exports.handler = serverless(app);
