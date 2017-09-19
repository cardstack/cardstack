const log = require('@cardstack/plugin-utils/logger')('orchestrator');

function start() {
  log.info('totally starting everything up');
  return Promise.resolve();
}

function stop() {
  log.info('ok, everything totally shut down successfully');
  process.exit();
}


module.exports = {
  start,
  stop
};
