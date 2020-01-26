#!/usr/bin/env node

/* eslint-disable node/shebang */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-require-imports */
const esmRequire = require('@std/esm')(module, { mode: 'js', cjs: true });
module.exports = esmRequire('./../main').bootEnvironment();
