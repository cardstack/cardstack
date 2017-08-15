const debug = require('./debug');
const levels = ['trace', 'debug', 'info', 'warn', 'error'];
const { format } = require('util');

class GlobalLogger {
  constructor() {
    this.expected = [];
    this.level = levels.indexOf((process.env.DEBUG_LEVEL || 'info').toLowerCase());
    this.printers = new Map();
  }
  write(namespace, levelIndex, ...logEntry) {
    if (levelIndex >= this.level) {
      if (this.expected.length > 0) {
        let formatted = format(...logEntry);
        let matched = this.expected.find(e => e.levelIndex === levelIndex && e.pattern.test(formatted));
        if (matched) {
          matched.count++;
          return;
        }
      }
      this.print(namespace, logEntry);
    }
  }
  print(namespace, logEntry) {
    let printer = this.printers.get(namespace);
    if (!printer) {
      printer = debug(namespace);
      this.printers.set(namespace, printer);
    }
    printer(...logEntry);
  }
  async expect(levelIndex, pattern, fn) {
    let entry = {
      levelIndex,
      pattern,
      count: 0
    };
    this.expected.push(entry);
    await fn();
    this.expected.splice(this.expected.indexOf(entry), 1);
    if (entry.count === 0) {
      throw new Error(`Expected a log mesage to match ${pattern} but none did`);
    } else if (entry.count !== 1) {
      throw new Error(`Expected one log mesage to match ${pattern} but ${entry.count} did`);
    }
  }
  registerFormatter(letter, func) {
    if (debug.formatters[letter] && debug.formatters[letter].toString() !== func.toString()) {
      throw new Error("namespace collision in log formatters for %t");
    }
    debug.formatters[letter] = func;
  }
}

if (!global.__cardstack_global_logger) {
  global.__cardstack_global_logger = new GlobalLogger();
}

class CardstackChannel {
  constructor(namespace) {
    this.namespace = namespace;
  }
}

class NullLogger {}
function noop() {}

function logger(channelName) {
  let namespace = `cardstack/${channelName}`;
  if (debug.enabled(namespace)) {
    return new CardstackChannel(namespace);
  } else {
    return new NullLogger();
  }
}

logger.registerFormatter = function(letter, func) {
  global.__cardstack_global_logger.registerFormatter(letter, func);
};

for (let [index, level] of levels.entries()) {

  CardstackChannel.prototype[level] = function(...args) {
    return global.__cardstack_global_logger.write(this.namespace, index, ...args);
  };
  NullLogger.prototype[level] = noop;
  logger['expect' + level.slice(0, 1).toUpperCase() + level.slice(1)] = async function(pattern, fn) {
    return global.__cardstack_global_logger.expect(index, pattern, fn);
  };
}



module.exports = logger;
