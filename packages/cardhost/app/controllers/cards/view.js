import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

export default class ViewCardController extends Controller {
  @service cssModeToggle;
  @service router;
  @service cardstackSession;
  resizeable = true;

  get cardJson() {
    if (!this.model) {
      return null;
    }
    return JSON.stringify(this.model.json, null, 2);
  }

  @tracked
  themerOptions = [{ name: 'Cardstack default' }];

  @action
  handleThemeChange(/*val*/) {
    // TODO
  }

  @action
  createTheme() {
    this.cssModeToggle.setEditingCss(true);
    this.themerOptions.push({ name: 'Custom theme' });
    this.router.transitionTo('cards.view', this.model, { queryParams: { editingCss: true } });
  }

  @action
  save() {
    this.model.save();
  }

  @action
  closeEditor() {
    this.cssModeToggle.setEditingCss(false);
    this.router.transitionTo('cards.view', this.model, { queryParams: { editingCss: undefined } });
  }

  @action
  updateCode(code) {
    this.model.setIsolatedCss(code);
  }
}
