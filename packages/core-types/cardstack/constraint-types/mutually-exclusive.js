const isBlank = (obj) => {
  let none = obj === null || obj === undefined;
  if (none) {
    return none;
  }

  if (typeof obj.size === 'number') {
    return !obj.size;
  }

  let objectType = typeof obj;

  if (objectType === 'object') {
    let size =obj.size;
    if (typeof size === 'number') {
      return !size;
    }
  }

  if (typeof obj.length === 'number' && objectType !== 'function') {
    return !obj.length;
  }

  if (objectType === 'object') {
    let length = obj.length;
    if (typeof length === 'number') {
      return !length;
    }
  }

  if (typeof obj === 'string') {
    return /\S/.test(obj) === false;
  }

  return false;
}

module.exports = {
  inputs: {
    target: ['@cardstack/core-types::string'],
    alternative: ['@cardstack/core-types::integer']
  },
  description: `Only either {{target.name}} or {{alternative.name}} can have a value, not both.`,
  valid({ target, alternative }) {
    return isBlank(target.value) || isBlank(alternative.value);
  }
};
