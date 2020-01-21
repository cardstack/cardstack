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
  themerOptions = [{ name: 'Cardstack default' }, { name: 'Custom theme' }];

  @action
  createTheme() {
    this.router.transitionTo('cards.card.edit.layout.themer', this.model);
  }

  get selectedTheme() {
    let css = this.model.isolatedCss;
    let isDefault = true;

    if (css) {
      // Some cards have a null value for isolatedCss, so we have to typecheck
      // For the comparison, first strip out whitespace and newlines so that extra whitespace doesn't register as a custom theme
      css = css.replace(/\s*|[\r\n]/g, '');
      isDefault = css === '' || css === '.cardstack_base-card-isolated{}';
    }
    return isDefault ? { name: 'Cardstack default' } : { name: 'Custom theme' };
  }

  @action
  handleThemeChange(val) {
    if (val.name === 'Cardstack default') {
      this.model.setIsolatedCss('.cardstack_base-card-isolated {}');
    }
  }
}
