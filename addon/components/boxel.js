import Component from '@ember/component';
import { computed, action } from '@ember/object';
import { inject as service } from '@ember/service';
import template from '../templates/components/boxel';
import { layout, tagName } from '@ember-decorators/component';

@layout(template)
@tagName('')
export default class BoxelComponent extends Component {
  @service boxel;

  @computed('content')
  get contentType() {
    if (this.content) {
      return this.content.constructor.modelName;
    }

    return null;
  }

  constructor() {
    super(...arguments);

    this.boxel.registerBoxel(this);
  }

  get name() {
    if (this._name) {
      return this._name;
    }

    return `boxel-${this.elementId}`;
  }

  set name(name) {
    this._name = name;
  }

  clickAction() {}

  @action
  moveToPlane(planeId) {
    this.set('plane', planeId);
  }
}
