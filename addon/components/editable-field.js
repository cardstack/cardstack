import Component from '@ember/component';
import { computed } from '@ember/object';
import template from '../templates/components/editable-field';
import { layout, tagName } from '@ember-decorators/component';
import fade from 'ember-animated/transitions/fade';

@layout(template)
@tagName('')
export default class EditableFieldComponent extends Component {
  fade = fade;

  get mode() {
    if (this._mode) {
      return this._mode;
    }

    return 'view';
  }

  set mode(mode) {
    this._mode = mode;
  }

  @computed('transition')
  get defaultTransition() {
    if (this.transition) {
      return this.transition;
    }

    return this.fade;
  }
}
