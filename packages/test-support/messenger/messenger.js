module.exports = class TestMessenger {
  static create() {
    return new this();
  }
  constructor() {
    this.sentMessages = [];
  }
  send(message, params) {
    this.sentMessages.push({ message, params });
  }
};
