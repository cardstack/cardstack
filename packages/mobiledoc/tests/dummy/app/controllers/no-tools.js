import Controller from '@ember/controller';

export default Controller.extend({
  init() {
    this._super(...arguments);
    this.dongles = {
      version: '0.3.0',
      atoms: [],
      cards: [],
      markups: [],
      sections: [[1, 'p', [[0, [], 0, 'I am a dongle.']]]],
    };
  },
});
