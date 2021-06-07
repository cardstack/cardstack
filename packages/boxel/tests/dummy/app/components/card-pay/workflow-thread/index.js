import Component from '@glimmer/component';
import { action, set } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { reads } from 'macro-decorators';

import move from 'ember-animated/motions/move';
import { fadeIn } from 'ember-animated/motions/opacity';
import { parallel, wait } from 'ember-animated';
import { easeOut } from 'ember-animated/easings/cosine';

export default class WorkflowThread extends Component {
  @tracked displayCompletionMessage = false;
  @tracked progress = this.progressLevel || 0;
  @reads('args.milestones.0.datetime') startTimestamp;
  @reads('args.milestones.length') milestonesLength;

  get milestone() {
    return this.args.milestones[this.progress];
  }

  get progressLevel() {
    return this.args.milestones.filter((el) => el.complete === true).length;
  }

  get progressStatus() {
    if (!this.milestonesLength) {
      return null;
    }

    if (this.progress === 0) {
      return 'Workflow started';
    }

    return this.args.milestones[this.progress - 1].statusOnCompletion;
  }

  @action
  toggleComplete(milestone) {
    set(milestone, 'complete', !milestone.complete);
    set(milestone, 'rendered', true);
  }

  @action
  updateProgress() {
    if (this.progress === this.milestonesLength) {
      return;
    }

    this.progress++;

    if (this.progress === this.milestonesLength) {
      this.displayCompletionMessage = true;
    }
  }

  *transition({ insertedSprites }) {
    // printSprites(arguments[0]);

    for (let sprite of insertedSprites) {
      sprite.startTranslatedBy(0, 30);
      parallel(
        fadeIn(sprite, { easing: easeOut, duration: 200 }),
        move(sprite, { easing: easeOut, duration: 200 })
      );
      // stagger
      yield wait(800);
    }
  }

  *bannerTransition({ insertedSprites }) {
    for (let sprite of insertedSprites) {
      sprite.startTranslatedBy(0, 30);
      parallel(
        fadeIn(sprite, { easing: easeOut, duration: 1000 }),
        move(sprite, { easing: easeOut, duration: 1000 })
      );
    }
  }
}
