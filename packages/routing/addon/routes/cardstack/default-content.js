import CommonBaseRoute from './common';

export default CommonBaseRoute.extend({
  model({ slug }) {
    return this._commonModelHook(this.get('service.defaultContentType'), slug);
  }
});
