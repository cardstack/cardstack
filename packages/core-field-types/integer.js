module.exports = {
  valid(value) {
    return typeof value==='number' && (value%1)===0;
  },
  defaultMapping() {
    return {
      type: "long"
    };
  }
};
