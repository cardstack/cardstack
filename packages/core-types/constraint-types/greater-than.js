module.exports = {
  description: `{{larger.name}} must be greater than {{smaller.name}}`,
  inputs: {
    smaller: ['@cardstack/core-types::integer'],
    larger:  ['@cardstack/core-types::integer']
  },
  valid({ smaller, larger }) {
    return smaller.value == null || larger.value == null || smaller.value < larger.value;
  }
};
