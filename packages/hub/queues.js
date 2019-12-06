const Queue = require('@cardstack/queue');
const { declareInjections } = require('@cardstack/di');
const log = require('@cardstack/logger')('cardstack/queue');

module.exports = declareInjections(
  {
    config: 'config:pg-boss',
  },
  class Queues {
    static create({ config }) {
      log.debug('Creating new queue instance');
      return new Queue(config);
    }

    static async teardown(instance) {
      log.debug('Tearing down queue instance');
      await instance.stop();
    }
  }
);
