const Handlebars = require('handlebars');
module.exports = {
  valid(value) {
    try {
      Handlebars.precompile(value);
      return true;
    } catch(err) {
      return false;
    }
  },
};
