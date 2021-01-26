import Component from '@glimmer/component';
import './style.css';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import move from 'ember-animated/motions/move';
import { fadeIn } from 'ember-animated/motions/opacity';
import { parallel, wait } from 'ember-animated';
import { easeOut } from 'ember-animated/easings/cosine';
// import { printSprites } from 'ember-animated';

export default class ThreadModalComponent extends Component {
  @tracked progress = 0; // resetting to 0 so we can demo
  @tracked expanded = false;
  @tracked isCancelled = false;
  @tracked isCompleted = false;
  @tracked startTimestamp = this.args.model.workflow?.milestones[0]?.datetime;

  @action
  toggleExpand() {
    this.expanded = !this.expanded;
  }

  get milestone() {
    return this.args.model.workflow?.milestones[this.progress];
  }

  get progressStatus() {
    if (!this.args.model.workflow?.milestones?.length) {
      return null;
    }

    if (this.progress === 0) {
      return 'Workflow started';
    }

    return this.args.model.workflow.milestones[this.progress - 1]
      .statusOnCompletion;
  }

  @action
  updateProgress() {
    if (this.progress === this.args.model.workflow.milestones.length) {
      return;
    }
    this.progress++;
  }

  *revealCard({ insertedSprites, duration }) {
    // printSprites(arguments[0]);

    for (let sprite of insertedSprites) {
      yield wait(duration);
      sprite.startTranslatedBy(0, 30);
      parallel(
        fadeIn(sprite, { easing: easeOut, duration: 400 }),
        move(sprite, { easing: easeOut, duration: 400 })
      );
    }
  }

  *bannerTransition({ insertedSprites }) {
    // printSprites(arguments[0]);

    for (let sprite of insertedSprites) {
      yield wait(200);
      sprite.startTranslatedBy(0, 30);
      parallel(
        fadeIn(sprite, { easing: easeOut, duration: 1000 }),
        move(sprite, { easing: easeOut, duration: 1000 })
      );
    }
  }
}
