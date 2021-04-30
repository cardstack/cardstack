//@ts-ignore not actually redefining block-scoped var
const esmRequire = require('esm')(module, { cjs: true });
module.exports = esmRequire('./index');
