import CommonBaseRoute from './common';

export default CommonBaseRoute.extend({
  model({ path }, transition) {
    return this._commonModelHook(path, transition);
  },
});
