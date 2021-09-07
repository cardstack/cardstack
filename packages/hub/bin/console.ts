#!/usr/bin/env node

/* eslint-disable node/shebang */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-require-imports */

require('dotenv').config();

//@ts-ignore not actually redefining block-scoped var
const esmRequire = require('esm')(module, { cjs: true });
let repl = require('repl');

//@ts-ignore not actually redefining block-scoped var
let container = esmRequire('./../main').bootEnvironment();
let replServer = repl.start({
  prompt: 'Hub > ',
});
replServer.context.container = container;
