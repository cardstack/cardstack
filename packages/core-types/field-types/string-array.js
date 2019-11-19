let StringType = require('./string');

module.exports = {
  valid(value) {
    return Array.isArray(value) && value.every(item => StringType.valid(item));
  },
};
