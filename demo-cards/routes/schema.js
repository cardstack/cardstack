export default class Routes {
  routeTo(path) {
    if (path === 'welcome') {
      return 'http://demo.com/cards/welcome';
    }

    if (path === 'about') {
      return 'http://demo.com/cards/about';
    }
  }
}
