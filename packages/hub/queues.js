const Queue = require('@cardstack/queue');

module.exports = class Queues {
  static create() {
    return new Queue();
  }
};
