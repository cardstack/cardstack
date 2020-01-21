import CardManipulator from './card-manipulator';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

export default class CardViewer extends CardManipulator {
  @service router;
  @service cardstackSession;

  resizeable = true;

  @tracked
  themerOptions = [{ name: 'Cardstack default' }];

  @action
  createTheme() {
    this.themerOptions.push({ name: 'Custom theme' });
    this.selectedTheme = this.themerOptions[this.themerOptions.length - 1];
    this.router.transitionTo('cards.card.edit.layout.themer', this.args.card);
  }

  get cardJson() {
    if (!this.args.card) {
      return null;
    }
    return JSON.stringify(this.args.card.json, null, 2);
  }

  @tracked
  selectedTheme = this.themerOptions[0];

  @action
  handleThemeChange(val) {
    this.selectedTheme = val;
    //  TODO
  }
}
