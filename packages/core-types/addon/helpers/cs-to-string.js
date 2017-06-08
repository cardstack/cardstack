import Ember from 'ember';

export default Ember.Helper.helper(function([a]) {
  return a ? String(a) : a;
});
