const Error = require('@cardstack/plugin-utils/error');
exports.authenticate = async function() {
  throw new Error("Your input is terrible and you should feel bad", { status: 400 });
};
