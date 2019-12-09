import CommonBaseRoute from './common';

export default CommonBaseRoute.extend({
  model(params, transition) {
    return this._commonModelHook('/', transition);
  },
});
