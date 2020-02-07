import { Motion } from 'ember-animated';
import resize from 'ember-animated/motions/resize';

export default function resizeAfterDelay(sprite, opts) {
  return new ResizeAfterDelay(sprite, opts).run();
}

export class ResizeAfterDelay extends Motion {
  constructor(sprite, opts) {
    super(sprite, opts);
  }

  *animate() {
    let sprite = this.sprite;

    yield setTimeout(() => {}, 250);
    yield resize(sprite, { duration: 250 });
  }
}
