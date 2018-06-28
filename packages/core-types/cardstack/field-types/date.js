const moment = require('moment-timezone');

module.exports = {
  valid(value) {
    return moment(value, moment.ISO_8601).isValid();
  },
  generateDefault(input) {
    if (input === 'now') {
      return moment().toISOString();
    }
  }
};
