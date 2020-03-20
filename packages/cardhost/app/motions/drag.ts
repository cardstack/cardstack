import { Motion, rAF } from 'ember-animated';
import Sprite from 'ember-animated/-private/sprite';
import { BaseOptions } from 'ember-animated/-private/motion';
//@ts-ignore
import move from 'ember-animated/motions/move';

export default function drag(sprite: Sprite, opts?: Options) {
  return new Drag(sprite, opts).run();
}

interface Options extends BaseOptions {
  others: Sprite[];
  onCollision?: (payload: any) => void;
}

interface Target {
  x: number;
  y: number;
  payload: any;
}

class Drag extends Motion<Options> {
  prior?: Drag | null;
  dragStartX: number | null;
  dragStartY: number | null;
  xStep: number | null;
  yStep: number | null;

  constructor(sprite: Sprite, opts?: Options) {
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

  interrupted(motions: Motion<Options>[]) {
    this.prior = motions.find(m => m instanceof Drag) as Drag;
  }

  *animate(this: Drag) {
    let sprite = this.sprite;

    let initialTx, initialTy;
    if (this.prior) {
      this.dragStartX = this.prior.dragStartX;
      this.dragStartY = this.prior.dragStartY;
      this.xStep = this.prior.xStep;
      this.yStep = this.prior.yStep;
      initialTx = sprite.transform.tx - sprite.absoluteInitialBounds.left + (this.dragStartX || 0);
      initialTy = sprite.transform.ty - sprite.absoluteInitialBounds.top + (this.dragStartY || 0);
    } else {
      this.dragStartX = sprite.absoluteInitialBounds.left;
      this.dragStartY = sprite.absoluteInitialBounds.top;
      this.xStep = 0;
      this.yStep = 0;
      initialTx = sprite.transform.tx;
      initialTy = sprite.transform.ty;
    }

    // targets are all in absolute screen coordinates
    let targets = (this.opts.others || [])
      .map(s => (s.absoluteFinalBounds ? makeTarget(s.absoluteFinalBounds, s) : null))
      .filter(Boolean) as Target[];
    let ownTarget = sprite.absoluteFinalBounds ? makeTarget(sprite.absoluteFinalBounds, sprite) : null;

    let dragState = (sprite?.owner?.value as any)?.dragState;
    let outline;
    if (dragState && dragState.usingKeyboard) {
      outline = 'dashed red';
    } else {
      outline = 'none';
    }

    sprite.applyStyles({
      'z-index': '1',
      outline,
      'box-shadow': '0px 15px 30px 0px rgba(0,0,0,0.25)',
    });

    // when we first start a new "keyboard" drag, adjust the active
    // sprite to catch up with any prior movement.
    if (dragState && dragState.usingKeyboard) {
      yield move(sprite);
    }

    while ((sprite?.owner?.value as any)?.dragState) {
      let dragState = (sprite?.owner?.value as any)?.dragState;
      if (dragState.usingKeyboard) {
        (sprite.element as HTMLElement).focus();
        let chosenTarget = ownTarget;
        while (chosenTarget && typeof this.xStep === 'number' && this.xStep > dragState.xStep) {
          chosenTarget = chooseNextToLeft(chosenTarget, targets);
          this.xStep -= 1;
        }
        while (chosenTarget && typeof this.xStep === 'number' && this.xStep < dragState.xStep) {
          chosenTarget = chooseNextToRight(chosenTarget, targets);
          this.xStep += 1;
        }
        while (chosenTarget && typeof this.yStep === 'number' && this.yStep > dragState.yStep) {
          chosenTarget = chooseNextToUp(chosenTarget, targets);
          this.yStep -= 1;
        }
        while (chosenTarget && typeof this.yStep === 'number' && this.yStep < dragState.yStep) {
          chosenTarget = chooseNextToDown(chosenTarget, targets);
          this.yStep += 1;
        }
        if (chosenTarget && chosenTarget !== ownTarget && this.opts.onCollision) {
          this.opts.onCollision(chosenTarget.payload);
        }
      } else {
        // these track relative motion since the drag started
        let dx = dragState.latestPointerX - dragState.initialPointerX;
        let dy = dragState.latestPointerY - dragState.initialPointerY;

        // adjust our transform to match the latest relative mouse motion
        sprite.translate(dx + initialTx - sprite.transform.tx, dy + initialTy - sprite.transform.ty);
      }
      yield rAF();
    }
  }
}

export function makeTarget(bounds: DOMRect, payload: any): Target {
  return {
    x: bounds.left + bounds.width / 2,
    y: bounds.top + bounds.height / 2,
    payload,
  };
}

export function chooseNextToLeft(chosenTarget: Target, targets: Target[]) {
  let candidates = targets.filter(target => {
    if (target.x >= chosenTarget.x) {
      return false;
    }
    let limit = (chosenTarget.x - target.x) / 2;
    return target.y <= chosenTarget.y + limit && target.y >= chosenTarget.y - limit;
  });
  return closest(chosenTarget, candidates) || chosenTarget;
}

export function chooseNextToRight(chosenTarget: Target, targets: Target[]) {
  let candidates = targets.filter(target => {
    if (target.x < chosenTarget.x) {
      return false;
    }
    let limit = (chosenTarget.x - target.x) / -2;
    return target.y <= chosenTarget.y + limit && target.y >= chosenTarget.y - limit;
  });
  return closest(chosenTarget, candidates) || chosenTarget;
}

export function chooseNextToUp(chosenTarget: Target, targets: Target[]) {
  let candidates = targets.filter(target => {
    if (target.y >= chosenTarget.y) {
      return false;
    }
    let limit = (chosenTarget.y - target.y) / 2;
    return target.x <= chosenTarget.x + limit && target.x >= chosenTarget.x - limit;
  });
  return closest(chosenTarget, candidates) || chosenTarget;
}

export function chooseNextToDown(chosenTarget: Target, targets: Target[]) {
  let candidates = targets.filter(target => {
    if (target.y < chosenTarget.y) {
      return false;
    }
    let limit = (chosenTarget.y - target.y) / -2;
    return target.x <= chosenTarget.x + limit && target.x >= chosenTarget.x - limit;
  });
  return closest(chosenTarget, candidates) || chosenTarget;
}

function closest(chosenTarget: Target, candidates: Target[]) {
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
