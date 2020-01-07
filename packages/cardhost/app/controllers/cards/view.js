import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

export default class ViewCardController extends Controller {
  @service router;
  @service cardstackSession;
  resizeable = true;

  @tracked
  themerOptions = [{ name: 'Cardstack default' }];

  @action
  createTheme() {
    this.themerOptions.push({ name: 'Custom theme' });
    this.selectedTheme = this.themerOptions[this.themerOptions.length - 1];
    this.router.transitionTo('cards.themer', this.model);
  }

  get cardJson() {
    if (!this.model) {
      return null;
    }
    return JSON.stringify(this.model.json, null, 2);
  }

  @tracked
  selectedTheme = this.themerOptions[0];

  @action
  handleThemeChange(val) {
    this.selectedTheme = val;
    //  TODO
  }

  @action
  save() {
    this.model.save();
  }
}
