module.exports = {
  inputs: {
    target: [],
  },
  description: `{{target.name}} must be present`,
  valid({ target }) {
    return target.value != null;
  },
};
