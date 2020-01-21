import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

export default class CardLayoutIndexController extends Controller {
  @service cssModeToggle;
  @service router;
  @service cardstackSession;
  resizeable = true;

  @tracked
  themerOptions = [{ name: 'Cardstack default' }];
  @tracked
  selectedTheme = this.themerOptions[0];

  @action
  createTheme() {
    this.themerOptions.push({ name: 'Custom theme' });
    this.selectedTheme = this.themerOptions[this.themerOptions.length - 1];
    this.router.transitionTo('cards.card.edit.layout.themer', this.model);
  }

  @action
  updateCode(code) {
    this.model.setIsolatedCss(code);
  }

  @action
  handleThemeChange(val) {
    this.selectedTheme = val;
    //  TODO
  }
}
