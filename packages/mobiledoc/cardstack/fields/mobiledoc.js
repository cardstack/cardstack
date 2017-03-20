module.exports = {
  valid(value) {
    return typeof value === 'object';
  },
  defaultMapping() {
    return {
      type: "text",
      fields: {
        raw: {
          type: "keyword"
        }
      }
    };
  }
};
