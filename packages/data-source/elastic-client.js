const ES = require('elasticsearch');
const logger = require('heimdalljs-logger');

function host() {
  return 'http://10.0.15.2:9200';
}

module.exports = function makeClient() {
  return new ES.Client({
    host: host(),
    log: LogBridge,
    apiVersion: '5.x'
  });
};

class LogBridge {
  constructor(/* config */) {
    this.log = logger('elasticsearch');
  }
  trace(method, requestUrl, body, responseBody, responseStatus) {
    this.log.trace(`${method} ${requestUrl.path} ${responseStatus}`);
  }
  close() {}
}
for (let level of ['error', 'warning', 'info', 'debug']) {
  LogBridge.prototype[level] = function() {
    let ourLevel = level;
    if (level === 'warning') {
      ourLevel = 'warn';
    }
    this.log[ourLevel].apply(this.log, arguments);
  };
}
