const moment = require('moment-timezone');

module.exports = {
  valid(value) {
    return value == null || moment(value, moment.ISO_8601).isValid();
  }
};
