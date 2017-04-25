module.exports = {
  valid(value) {
    return true;
  },

  // disable indexing
  defaultMapping() {
    return {
      enabled: false
    };
  },
};
