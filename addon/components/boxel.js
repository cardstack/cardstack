import Component from '@ember/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import template from '../templates/components/boxel';
import { layout, tagName } from '@ember-decorators/component';

import resize from 'ember-animated/motions/resize';
import move from 'ember-animated/motions/move';
import scale from 'ember-animated/motions/scale';
import { parallel, wait } from 'ember-animated';


@layout(template)
@tagName('')
export default class BoxelComponent extends Component {
  @service boxel;

  duration = 1000;
  preserveScrollPosition = true;

  constructor() {
    super(...arguments);

    this.plane = this.boxel.currentPlane;
  }

  didInsertElement() {
    this._super(...arguments);

    this.boxel.registerBoxel(this);
  }

  @tracked content;
  get contentType() {
    if (this.content) {
      return this.content.constructor.modelName;
    }

    return null;
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

  transition = function*({ sentSprites, receivedSprites }) {
    try {
      // printSprites(arguments[0]);

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

  resize = function*({ insertedSprites, removedSprites, keptSprites }) {
    try {
      // printSprites(arguments[0]);

      let insertedSprite = insertedSprites[0];
      let removedSprite = removedSprites[0];

      insertedSprite.startAtSprite(removedSprite);
      removedSprite.endAtSprite(insertedSprite);

      move(insertedSprite);
      move(removedSprite);
      resize(insertedSprite);
      resize(removedSprite);

      keptSprites.forEach(move);
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
