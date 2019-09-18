import Component from '@ember/component';
import { computed } from '@ember/object';
import template from '../templates/components/boxel-field';
import { layout, tagName } from '@ember-decorators/component';
import fade from 'ember-animated/transitions/fade';
import { toUp, toDown } from 'ember-animated/transitions/move-over';

@layout(template)
@tagName('')
export default class BoxelFieldComponent extends Component {
  fade = fade;
  toUp = toUp;
  toDown = toDown;

  @computed('transition')
  get defaultTransition() {
    if (this.transition) {
      return this.transition;
    }

    return this.fade;
  }

  @computed('model.mode')
  get mode() {
    if (this.model) {
      return this.model.mode;
    }

    if (this._mode) {
      return this._mode;
    }

    return 'view';
  }

  set mode(mode) {
    this.set('_mode', mode);

    return mode;
  }
}
