#!/usr/bin/env node

/* eslint-disable node/shebang */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-require-imports */

require('dotenv').config();

//@ts-ignore not actually redefining block-scoped var
let repl = require('repl');

//@ts-ignore not actually redefining block-scoped var
let container = require('./../main').bootEnvironment();
let replServer = repl.start({
  prompt: 'Hub > ',
});
replServer.context.container = container;
