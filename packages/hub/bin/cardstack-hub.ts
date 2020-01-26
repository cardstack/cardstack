#!/usr/bin/env node

/* eslint-disable node/shebang */
const esmRequire = require("@std/esm")(module, { mode: "js", cjs: true });
module.exports = esmRequire('./../main').bootEnvironment();