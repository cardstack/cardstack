import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

export default class CardViewer extends Component {
  @service router;
  @service cardstackSession;

  resizeable = true;

  @tracked
  themerOptions = [{ name: 'Cardstack default' }, { name: 'Custom theme' }];

  @action
  createTheme() {
    this.router.transitionTo('cards.card.edit.layout.themer', this.args.card);
  }

  get cardJson() {
    if (!this.args.card) {
      return null;
    }
    return JSON.stringify(this.args.card.json, null, 2);
  }

  get selectedTheme() {
    let css = this.args.card.isolatedCss;
    let isDefault = css === '' || css === '.cardstack_base-card-isolated {}';
    return isDefault ? { name: 'Cardstack default' } : { name: 'Custom theme' };
  }

  @action
  handleThemeChange(val) {
    if (val.name === 'Cardstack default') {
      this.args.card.setIsolatedCss('');
    }
  }
}
