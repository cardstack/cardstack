import Route from '@ember/routing/route';

import '../css/variables.css';

export default class ApplicationRoute extends Route {
  afterModel() {
    console.warn(
      '%cBe careful!',
      'color: red; font-size: 20px;   font-weight: bold;'
    );
    console.warn('Never run commands here that you don’t understand.');
  }
}
