/* eslint-disable node/shebang */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-require-imports */

require('dotenv').config();
module.exports = require('./../main').bootWorker();
