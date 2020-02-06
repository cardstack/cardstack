import Controller from '@ember/controller';

export default class IndexController extends Controller {
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
}
