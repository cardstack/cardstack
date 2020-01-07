import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';

export default class ThemerCardController extends Controller {
  @service cssModeToggle;
  @service router;
  @service cardstackSession;
  resizeable = true;

  @action
  handleThemeChange(val) {
    this.selectedTheme = val;
    //  TODO
  }

  @action
  save() {
    this.model.save();
  }

  @action
  closeEditor() {
    this.router.transitionTo('cards.view', this.model.name);
  }

  @action
  updateCode(code) {
    this.model.setIsolatedCss(code);
  }
}
