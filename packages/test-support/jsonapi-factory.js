const esmRequire = require("@std/esm")(module, { mode: "js", cjs: true });
module.exports = esmRequire('./addon/jsonapi-factory').default;
