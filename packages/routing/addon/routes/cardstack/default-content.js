import CommonBaseRoute from './common';
import { defaultContentType } from '@cardstack/routing';

export default CommonBaseRoute.extend({
  model({ slug }) {
    return this._commonModelHook(defaultContentType, slug);
  }
});
