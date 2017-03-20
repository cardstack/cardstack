import Ember from 'ember';

export function csSillyHash(unused, hash) {
  let output = {};
  Object.keys(hash).forEach(key => {
    let m = /^key(\d+)/.exec(key);
    if (m && hash[key]) {
      output[hash[key]] = hash['value' + m[1]];
    }
  });
  return output;
}

export default Ember.Helper.helper(csSillyHash);
