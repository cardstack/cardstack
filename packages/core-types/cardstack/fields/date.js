const moment = require('moment-timezone');

module.exports = {
  valid(value) {
    return moment(value, moment.ISO_8601).isValid();
  },
  defaultMapping() {
    return {
      type: "date"
    };
  },
  generateDefault(input) {
    if (input === 'now') {
      return moment().toISOString();
    }
  }
};
