const Queue = require('@cardstack/queue');
const { declareInjections } = require('@cardstack/di');

module.exports = declareInjections({
  config: 'config:pg-boss'
},
class Queues {
  static create({config}) {
    return new Queue(config);
  }

  static async teardown(instance) {
    await instance.stop();
  }
});
