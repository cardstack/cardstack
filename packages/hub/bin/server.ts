#!/usr/bin/env node

/* eslint-disable node/shebang */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-require-imports */
//@ts-ignore not actually redefining block-scoped var
const esmRequire = require('esm')(module, { cjs: true });
module.exports = esmRequire('./../main').bootServer();
