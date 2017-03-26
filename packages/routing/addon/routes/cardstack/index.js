import CommonBaseRoute from './common';

export default CommonBaseRoute.extend({
  model() {
    let type = this.get('cardstackRouting.defaultContentType');
    let slug = ' ';
    return this._commonModelHook(type, slug);
  }
});
