/* eslint-disable ember/no-computed-properties-in-native-classes */

import Component from '@glimmer/component';
import fade from 'ember-animated/transitions/fade';
import { toUp, toDown } from 'ember-animated/transitions/move-over';
import { computed } from '@ember/object';
export default class BoxelFieldComponent extends Component {
  fade = fade;
  toUp = toUp;
  toDown = toDown;

  @computed('args.transition', 'fade', 'transition')
  get defaultTransition() {
    return this.args.transition || this.fade;
  }

  get mode() {
    return this.args.mode || this.args.model?.mode || 'view';
  }
}
