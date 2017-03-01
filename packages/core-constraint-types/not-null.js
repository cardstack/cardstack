module.exports = {
  valid(value /*, parameters */) {
    if (value == null) {
      return "may not be null";
    }
  }
};
