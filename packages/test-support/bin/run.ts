// We're using ESM here so that we can launch tests from VS Code's directly
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-require-imports */
const req = require('esm')(module, { cjs: true });
const runner = req('../node-test-runner').default;
runner();
