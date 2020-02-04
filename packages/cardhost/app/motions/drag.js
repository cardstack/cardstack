import { Motion, rAF } from 'ember-animated';
import move from 'ember-animated/motions/move';

export default function drag(sprite, opts) {
  return new Drag(sprite, opts).run();
}

class Drag extends Motion {
  constructor(sprite, opts) {
    super(sprite, opts);
    this.prior = null;

    // This is our own sprite's absolute screen position that
    // corresponds to the real start of dragging (which may span many
    // Drag instances, because of interruption)
    this.dragStartX = null;
    this.dragStartY = null;

    // When moving by keyboard, this is the net number of steps in
    // each direction we have already taken from the start of the
    // whole activity.
    this.xStep = null;
    this.yStep = null;
  }

  interrupted(motions) {
    this.prior = motions.find(m => m instanceof this.constructor);
  }

  *animate() {
    let sprite = this.sprite;

    let initialTx, initialTy;
    if (this.prior) {
      this.dragStartX = this.prior.dragStartX;
      this.dragStartY = this.prior.dragStartY;
      this.xStep = this.prior.xStep;
      this.yStep = this.prior.yStep;
      initialTx = sprite.transform.tx - sprite.absoluteInitialBounds.left + this.dragStartX;
      initialTy = sprite.transform.ty - sprite.absoluteInitialBounds.top + this.dragStartY;
    } else {
      this.dragStartX = sprite.absoluteInitialBounds.left;
      this.dragStartY = sprite.absoluteInitialBounds.top;
      this.xStep = 0;
      this.yStep = 0;
      initialTx = sprite.transform.tx;
      initialTy = sprite.transform.ty;
    }

    // targets are all in absolute screen coordinates
    let targets = this.opts.others.map(s => makeTarget(s.absoluteFinalBounds, s));
    let ownTarget = makeTarget(sprite.absoluteFinalBounds, sprite);

    let dragState = sprite.owner.value.dragState;
    let outline;
    if (dragState && dragState.usingKeyboard) {
      outline = 'dashed red';
    } else {
      outline = 'none';
    }

    sprite.applyStyles({
      'z-index': '1',
      outline,
    });

    // when we first start a new "keyboard" drag, adjust the active
    // sprite to catch up with any prior movement.
    if (dragState && dragState.usingKeyboard) {
      yield move(sprite);
    }

    while (sprite.owner.value.dragState) {
      let dragState = sprite.owner.value.dragState;
      if (dragState.usingKeyboard) {
        sprite.element.focus();
        let chosenTarget = ownTarget;
        while (this.xStep > dragState.xStep) {
          chosenTarget = chooseNextToLeft(chosenTarget, targets);
          this.xStep -= 1;
        }
        while (this.xStep < dragState.xStep) {
          chosenTarget = chooseNextToRight(chosenTarget, targets);
          this.xStep += 1;
        }
        while (this.yStep > dragState.yStep) {
          chosenTarget = chooseNextToUp(chosenTarget, targets);
          this.yStep -= 1;
        }
        while (this.yStep < dragState.yStep) {
          chosenTarget = chooseNextToDown(chosenTarget, targets);
          this.yStep += 1;
        }
        if (chosenTarget !== ownTarget && this.opts.onCollision) {
          this.opts.onCollision(chosenTarget.payload);
        }
      } else {
        // these track relative motion since the drag started
        let dx = dragState.latestPointerX - dragState.initialPointerX;
        let dy = dragState.latestPointerY - dragState.initialPointerY;

        // adjust our transform to match the latest relative mouse motion
        sprite.translate(dx + initialTx - sprite.transform.tx, dy + initialTy - sprite.transform.ty);

        // now this is our own absolute center position
        // let x = dx + this.dragStartX + sprite.absoluteFinalBounds.width / 2;
        // let y = dy + this.dragStartY + sprite.absoluteFinalBounds.height / 2;

        // let ownDistance = (x - ownTarget.x) * (x - ownTarget.x) + (y - ownTarget.y) * (y - ownTarget.y);
        // let closerTarget = targets.find(target => {
        //   let partialX = target.x - x;
        //   let partialY = target.y - y;
        //   let distance = partialX * partialX + partialY * partialY;
        //   return distance < ownDistance;
        // });

        // if (closerTarget && this.opts.onCollision) {
        //   this.opts.onCollision(closerTarget.payload);
        // }
      }
      yield rAF();
    }
  }
}

export function makeTarget(bounds, payload) {
  return {
    x: bounds.left + bounds.width / 2,
    y: bounds.top + bounds.height / 2,
    payload,
  };
}

export function chooseNextToLeft(chosenTarget, targets) {
  let candidates = targets.filter(target => {
    if (target.x >= chosenTarget.x) {
      return false;
    }
    let limit = (chosenTarget.x - target.x) / 2;
    return target.y <= chosenTarget.y + limit && target.y >= chosenTarget.y - limit;
  });
  return closest(chosenTarget, candidates) || chosenTarget;
}

export function chooseNextToRight(chosenTarget, targets) {
  let candidates = targets.filter(target => {
    if (target.x < chosenTarget.x) {
      return false;
    }
    let limit = (chosenTarget.x - target.x) / -2;
    return target.y <= chosenTarget.y + limit && target.y >= chosenTarget.y - limit;
  });
  return closest(chosenTarget, candidates) || chosenTarget;
}

export function chooseNextToUp(chosenTarget, targets) {
  let candidates = targets.filter(target => {
    if (target.y >= chosenTarget.y) {
      return false;
    }
    let limit = (chosenTarget.y - target.y) / 2;
    return target.x <= chosenTarget.x + limit && target.x >= chosenTarget.x - limit;
  });
  return closest(chosenTarget, candidates) || chosenTarget;
}

export function chooseNextToDown(chosenTarget, targets) {
  let candidates = targets.filter(target => {
    if (target.y < chosenTarget.y) {
      return false;
    }
    let limit = (chosenTarget.y - target.y) / -2;
    return target.x <= chosenTarget.x + limit && target.x >= chosenTarget.x - limit;
  });
  return closest(chosenTarget, candidates) || chosenTarget;
}

function closest(chosenTarget, candidates) {
  let closest;
  let closestDistance;
  for (let candidate of candidates) {
    let distance =
      (candidate.x - chosenTarget.x) * (candidate.x - chosenTarget.x) +
      (candidate.y - chosenTarget.y) * (candidate.y - chosenTarget.y);
    if (closestDistance == null || distance < closestDistance) {
      closestDistance = distance;
      closest = candidate;
    }
  }
  return closest;
}
