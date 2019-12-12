import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';

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

  get themerOptions() {
    let options = [{ name: 'Cardstack default' }];

    if (this.model.adoptedFrom) {
      options.push({ name: this.model.adoptedFromName });
    }

    if (this.model.isolatedCss) {
      options.push({ name: 'Custom Style' });
    }

    return options;
  }

  get selectedTheme() {
    if (this.model.isolatedCss) {
      return { name: 'Custom Style' };
    }
  }

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
}
