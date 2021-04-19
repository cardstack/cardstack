export default class Routes {
  routeTo(path) {
    if (path === 'welcome') {
      return 'https://demo.com/cards/welcome';
    }

    if (path === 'about') {
      return 'https://demo.com/cards/about';
    }
  }
}
