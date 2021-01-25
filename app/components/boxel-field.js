/* eslint-disable ember/no-computed-properties-in-native-classes */

import Component from '@glimmer/component';
import { computed } from '@ember/object';
import fade from 'ember-animated/transitions/fade';
import { toUp, toDown } from 'ember-animated/transitions/move-over';

export default class BoxelFieldComponent extends Component {
  fade = fade;
  toUp = toUp;
  toDown = toDown;

  @computed('args.transition', 'fade', 'transition')
  get defaultTransition() {
    if (this.args.transition) {
      return this.args.transition;
    }

    return this.fade;
  }

  @computed('args.{mode,model.mode}')
  get mode() {
    if (this.args.mode) {
      return this.args.mode;
    }

    if (this.args.model && this.args.model.mode) {
      return this.args.model.mode;
    }

    return 'view';
  }
}
