module.exports = {
  valid(value, parameters) {
    if (parameters.max != null && value != null && value.length > parameters.max) {
      return `may not exceed max length of ${parameters.max} characters`;
    }
    if (parameters.min != null && (value == null || value.length < parameters.min)) {
      return `must be at least ${parameters.min} characters long`;
    }
  }
};
