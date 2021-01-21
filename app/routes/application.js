import Route from '@ember/routing/route';

import '@cardstack/boxel/css/boxel.js';
export default class ApplicationRoute extends Route {
  title(tokens) {
    if (tokens) {
      return tokens.reverse().join(" - ");
    } else {
      return "Boxel";
    }
  }

}
