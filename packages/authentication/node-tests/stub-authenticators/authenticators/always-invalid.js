const Error = require('@cardstack/plugin-utils/error');

module.exports = class {
  static create() {
    return new this();
  }
  async authenticate() {
    throw new Error('Your input is terrible and you should feel bad', { status: 400 });
  }
};
