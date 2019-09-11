import { Motion, wait } from "ember-animated";

/**
  @function wait
  @export default
  @param {Sprite} sprite
  @return {Motion}
*/
export default function scale(sprite, opts) {
  return new Keep(sprite, opts).run();
}

export class Keep extends Motion {
  *animate() {
    yield wait(this.duration);
  }
}
