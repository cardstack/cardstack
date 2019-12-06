import Controller from '@ember/controller';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';

export default class IndexController extends Controller {
  @service scroller;

  @tracked selectedSection = 'recent-cards';

  @action
  scrollToSection(sectionId) {
    if (!sectionId) {
      return;
    }
    this.scroller.scrollToSection({
      selector: `.cardhost-section--${sectionId}`,
      elementOffset: 160,
      doneScrolling: () => (this.selectedSection = sectionId),
    });
  }
}
