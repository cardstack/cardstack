import Controller from '@ember/controller';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { AddressableCard } from '@cardstack/core/card';

export default class IndexController extends Controller {
  @service scroller;

  @tracked selectedSection = 'recent-cards';
  @tracked adoptFromCard;
  @tracked dialogTitle;
  @tracked showDialog;
  @tracked templates;

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

  @action
  openCardNameDialog(title, adoptFromCard) {
    this.adoptFromCard = adoptFromCard instanceof AddressableCard ? adoptFromCard : null; // need to guard against the mouseevent that gets curried into this function
    this.dialogTitle = title;
    this.showDialog = true;
  }

  @action
  closeDialog() {
    this.showDialog = false;
    this.adoptFromCard = null;
  }
}
