import Controller from '@ember/controller';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';

export default class IndexController extends Controller {
  @service cardstackSession;
  @service scroller;

  @tracked selectedSection = 'recent-cards';

  featuredCards = [
    {
      title: 'Product Ranking',
      preview: '/assets/images/cards/started-page/theme-product-ranking.png',
    },
    {
      title: 'Wedding Invitation',
      preview: '/assets/images/cards/started-page/theme-wedding-invitation.png',
    },
    {
      title: 'Event Ticket',
      preview: '/assets/images/cards/started-page/theme-event-ticket.png',
    },
    {
      title: 'Photo Card',
      preview: '/assets/images/cards/started-page/theme-photo-card.png',
    },
  ];

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
