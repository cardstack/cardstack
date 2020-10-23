import Component from '@glimmer/component';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { AddressableCard } from '@cardstack/hub';

export default class Library extends Component {
  @service library;
  @service scroller;
  @service router;

  @tracked selectedSection = 'recent-cards';
  @tracked adoptFromCard;
  @tracked dialogTitle;
  @tracked showDialog;

  @action
  visitCard(card) {
    this.library.hide();
    this.router.transitionTo('cards.card.view', card.canonicalURL);
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
    this.cardModel = null;
  }

  @action
  scrollToSection(sectionId) {
    if (!sectionId) {
      return;
    }
    this.scroller.scrollToSection({
      selector: `.library-section--${sectionId}`,
      elementOffset: 60,
      doneScrolling: () => (this.selectedSection = sectionId),
    });
  }
}
