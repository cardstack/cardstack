import Route from '@ember/routing/route';
import { isTesting } from '@embroider/macros';

import '../css/variables.css';

export default class ApplicationRoute extends Route {
  afterModel() {
    if (!isTesting()) {
      console.warn(
        '%cBe careful!',
        'color: red; font-size: 20px;   font-weight: bold;'
      );
      console.warn('Never run commands here that you don’t understand.');
    }
  }
}
