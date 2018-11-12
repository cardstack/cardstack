import CommonBaseRoute from './common';

export default CommonBaseRoute.extend({
  model({ type, slug }) {
    return this._commonModelHook(type, slug);
  },
});
