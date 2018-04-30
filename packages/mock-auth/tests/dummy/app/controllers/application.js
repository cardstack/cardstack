import Controller from '@ember/controller';

export default Controller.extend({
  actions: {
    onLogin() {
      this.set('didLogin', 'yes');
    }
  }
});
