import Controller from '@ember/controller';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { printSprites } from 'ember-animated';
import move from 'ember-animated/motions/move';

export default class IndexController extends Controller {
  @service scroller;

  @tracked selectedSection = 'recent-cards';

  @action
  scrollToSection(sectionId) {
    if (!sectionId) { return; }
    this.scroller.scrollToSection({
      selector: `.cardhost-section--${sectionId}`,
      elementOffset: 160,
      doneScrolling: () => this.selectedSection = sectionId
    });
  }

  * newCardTransition({ sentSprites, receivedSprites }) {
    printSprites(arguments[0]);

    sentSprites.forEach(sprite => {
      move(sprite, { easing: easeOut });

    });
  }
}