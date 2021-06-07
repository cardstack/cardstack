import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import resize from 'ember-animated/motions/resize';
import move from 'ember-animated/motions/move';
import scale from 'ember-animated/motions/scale';
import { parallel, wait } from 'ember-animated';

export default class BoxelComponent extends Component {
  @service boxel;

  duration = 1000;
  preserveScrollPosition = true;

  constructor() {
    super(...arguments);

    this.tag = this.args.tag || 'div';

    this.plane = this.boxel.currentPlane;
    this.boxel.registerBoxel(this);
  }

  @tracked content;

  get contentType() {
    if (this.args.content) {
      return this.args.content.constructor.modelName;
    }

    return null;
  }

  get name() {
    if (this.args.name) {
      return this.args.name;
    }

    return 'boxel-default';
  }
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  clickAction() {}

  transition = function* ({ sentSprites, receivedSprites }) {
    try {
      receivedSprites.concat(sentSprites).forEach((sprite) => {
        sprite.applyStyles({
          'z-index': '1',
        });
      });

      receivedSprites.forEach(parallel(scale, move));
      sentSprites.forEach(parallel(scale, move));
    } catch (err) {
      yield wait();
      throw new Error(err);
    }
  };

  resize = function* ({ insertedSprites, removedSprites, keptSprites }) {
    try {
      let insertedSprite = insertedSprites[0];
      let removedSprite = removedSprites[0];

      insertedSprite.startAtSprite(removedSprite);
      removedSprite.endAtSprite(insertedSprite);

      move(insertedSprite);
      move(removedSprite);
      resize(insertedSprite);
      resize(removedSprite);

      keptSprites.forEach(move);
    } catch (err) {
      yield wait();
      throw new Error(err);
    }
  };

  @action
  moveToPlane(planeId) {
    this.plane = planeId;
  }
}
