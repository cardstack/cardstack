export default class Routes {
  routeTo(path) {
    if (path === 'welcome') {
      return 'https://demo.com/welcome';
    }

    if (path === 'about') {
      return 'https://demo.com/about';
    }
  }
}
