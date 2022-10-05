import Route from '@ember/routing/route';
import '@cardstack/boxel/styles/global.css';
import '../css/app.css';

import { isTesting } from '@embroider/macros';

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
