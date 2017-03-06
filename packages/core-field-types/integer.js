module.exports = {
  valid(value) {
    typeof value==='number' && (value%1)===0;
  },
  defaultMapping() {
    return {
      type: "long"
    };
  }
};
