import { helper } from 'ember-helper';

export function csSillyHash(unused, hash) {
  // Implements a limited version of the (missing) handlebars splat operator
  // Input:  { key0=readingTimeValue value0=5 key1=readingTimeUnits value1='minutes', ...}
  // Output: { readingTimeValue: 5, readingTimeUnits: 'minutes', ... }
  let output = {};
  Object.keys(hash).forEach(key => {
    let m = /^key(\d+)/.exec(key);
    if (m && hash[key]) {
      output[hash[key]] = hash['value' + m[1]];
    }
  });
  return output;
}

export default helper(csSillyHash);
