module.exports = {
  inputs: {
    target: ['@cardstack/core-types::string'],
    limit: ['@cardstack/core-types::integer'],
  },
  description: '{{target.name}} must be at least {{limit.value}} characters long, it was {{target.value.length}}',
  valid({ target, limit }) {
    return target.value == null || limit.value == null || target.value.length >= limit.value;
  },
};
