/* eslint no-process-exit: "off", node/shebang: "off",  @typescript-eslint/no-var-requires: "off", @typescript-eslint/no-require-imports: "off", */
//@ts-ignore not actually redefining block-scoped var
const esmRequire = require('esm')(module, { cjs: true });
module.exports = esmRequire('./pre-codegen');
