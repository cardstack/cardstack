import Controller from '@ember/controller';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
export default class CardsIndexController extends Controller {
  @service router;

  featuredCards = [
    {
      id: 'product-card',
      title: 'Product Ranking',
      preview: '/assets/images/cards/started-page/theme-product-ranking.png',
    },
    {
      id: 'wedding-invitation',
      title: 'Wedding Invitation',
      preview: '/assets/images/cards/started-page/theme-wedding-invitation.png',
    },
    {
      id: 'event-ticket',
      title: 'Event Ticket',
      preview: '/assets/images/cards/started-page/theme-event-ticket.png',
    },
    {
      id: 'photo-card',
      title: 'Photo Card',
      preview: '/assets/images/cards/started-page/theme-photo-card.png',
    },
  ];

  @action
  viewCard(id) {
    this.router.transitionTo('cards.card.view', id);
  }
}
