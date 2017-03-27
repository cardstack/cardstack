import Ember from 'ember';

export function prettyJson([value]) {
  return JSON.stringify(value, null, 2);
}

export default Ember.Helper.helper(prettyJson);
