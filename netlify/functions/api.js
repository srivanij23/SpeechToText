const serverless = require('serverless-http');
const { app } = require('../../main.py');

module.exports.handler = serverless(app);