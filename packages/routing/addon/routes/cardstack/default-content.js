import CommonBaseRoute from './common';

export default CommonBaseRoute.extend({
  model({ slug }) {
    let type = this.get('cardstackRouting.defaultContentType');
    return this._commonModelHook(type, slug);
  }
});
