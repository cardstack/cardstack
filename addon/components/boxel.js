import Component from '@ember/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import template from '../templates/components/boxel';
import { layout, tagName } from '@ember-decorators/component';
import move from 'ember-animated/motions/move';
import scale from 'ember-animated/motions/scale';
import { parallel, printSprites, wait } from 'ember-animated';

@layout(template)
@tagName('')
export default class BoxelComponent extends Component {
  @service boxel;

  duration = 700;
  preserveScrollPosition = true;

  @tracked content;

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

  transition = function*({ receivedSprites, sentSprites }) {
    try {
      printSprites(arguments[0]);

      receivedSprites.concat(sentSprites).forEach(sprite => {
        sprite.applyStyles({
          'z-index': 1
        });
      });

      receivedSprites.forEach(parallel(scale, move));
      sentSprites.forEach(parallel(scale, move));
    }

    catch (err) {
      yield wait();
      throw new Error(err);
    }
  }

  @action
  moveToPlane(planeId) {
    this.set('plane', planeId);
  }
}
