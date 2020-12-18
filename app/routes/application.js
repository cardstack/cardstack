import Route from '@ember/routing/route';

export default class ApplicationRoute extends Route {
  title(tokens) {
    if (tokens) {
      return tokens.reverse().join(" - ");
    } else {
      return "Boxel";
    }
  }

}