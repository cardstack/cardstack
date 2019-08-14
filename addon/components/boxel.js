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

  init() {
    super.init(...arguments);

    this.boxel.registerBoxel(this);
  }

  @computed('elementId')
  get name() {
    return `boxel-${this.elementId}`;
  }

  clickAction() {}

  @action
  moveToPlane(planeId) {
    this.set('plane', planeId);
  }
}
