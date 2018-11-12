import CommonBaseRoute from './common';

export default CommonBaseRoute.extend({
  model() {
    let slug = ' ';
    return this._commonModelHook(this.get('service.defaultContentType'), slug);
  },
});
