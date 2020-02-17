import { Motion, rAF, Tween } from 'ember-animated';

/**
  Smoothly scales _sprite_ from its the initial size to its final size.

  _sprite_ must have both `initialBounds` and `finalBounds` set.

  ```js
  for (let sprite of insertedSprites) {
    sprite.startAtSprite(beacons['source']);
    scale(sprite)
  }
  ```

  @function scale
  @export default
  @param {Sprite} sprite
  @return {Motion}
*/
export default function scale(sprite, opts) {
  return new Scale(sprite, opts).run();
}

export class Scale extends Motion {
  constructor(sprite, opts) {
    super(sprite, opts);
    this.widthTween = null;
    this.heightTween = null;
  }

  *animate() {
    let sprite = this.sprite;
    let duration = this.duration;

    let initialWidthFactor, initialHeightFactor;

    if (sprite.originalInitialBounds) {
      // the sprite is going to start at its own native initial size,
      // which may differ from the initialBounds.width &
      // initialBounds.height that have been set for it. This
      // compensates with an initial scaling.
      initialWidthFactor = sprite.initialBounds.width / sprite.originalInitialBounds.width;
      initialHeightFactor = sprite.initialBounds.height / sprite.originalInitialBounds.height;
    } else {
      // the sprite is going to start at its own native final size
      initialWidthFactor = sprite.initialBounds.width / sprite.originalFinalBounds.width;
      initialHeightFactor = sprite.initialBounds.height / sprite.originalFinalBounds.height;
    }

    let widthFactor = this.opts.by;
    let heightFactor = this.opts.by;

    this.widthTween = new Tween(
      sprite.transform.a * initialWidthFactor,
      sprite.transform.a * initialWidthFactor * widthFactor,
      duration,
      this.opts.easing
    );
    this.heightTween = new Tween(
      sprite.transform.d * initialHeightFactor,
      sprite.transform.d * initialHeightFactor * heightFactor,
      duration,
      this.opts.easing
    );

    while (!this.widthTween.done || !this.heightTween.done) {
      sprite.scale(
        this.widthTween.currentValue / sprite.transform.a,
        this.heightTween.currentValue / sprite.transform.d
      );
      yield rAF();
    }
  }
}
