import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import { cardDocument } from '@cardstack/hub';
import { getUserRealm } from '../utils/scaffolding';
import { CARDSTACK_PUBLIC_REALM } from '@cardstack/hub';
import DataService from '../services/data';

export default class UIComponentsRoute extends Route {
  @service data!: DataService;
  async model() {
    let unsavedParent = await this.data.create(
      getUserRealm(),
      cardDocument()
        .withAttributes({
          csTitle: 'Parent Card',
        })
        .withField('title', 'string-field')
        .withField('description', 'string-field').jsonapi
    );
    let parentCard = await this.data.save(unsavedParent);

    let unsavedCard = await this.data.create(
      getUserRealm(),
      cardDocument()
        .adoptingFrom(parentCard)
        .withAutoAttributes({
          csTitle: 'Event Card',
          title: 'Ember Meetup',
          description:
            'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Fusce sed scelerisque ex, sed elementum lorem. Phasellus sit amet ipsum in tellus vestibulum tincidunt. Etiam rhoncus, orci quis elementum pulvinar, leo lectus feugiat ligula, vel tincidunt massa elit eu augue. Nulla eget tortor non est ullamcorper egestas eu sit amet justo. Cras consectetur tempor dui, eget finibus orci vestibulum vitae. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia Curae; Donec faucibus mi sed turpis posuere euismod. Sed leo erat, ultricies non ligula eu, ornare consectetur justo. Donec non orci tellus. Aenean ac nibh imperdiet, sollicitudin risus eu, malesuada ante. Interdum et malesuada fames ac ante ipsum primis in faucibus. Nullam commodo sed lorem posuere lobortis. Nam a condimentum nulla, nec tempor dolor. Fusce tincidunt, mi at viverra cursus, tellus metus consequat massa, nec interdum urna ante non libero.',
          'main-image': 'https://images.unsplash.com/photo-1542296140-47fd7d838e76',
          datetime: '2019-09-26',
          'social-link': 'https://example.com',
          rsvp: 'https://example.com',
          'sample-name': 'Ember Meetup',
          'sample-title': 'Ember Meetup',
          'sample-description':
            'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Fusce sed scelerisque ex, sed elementum lorem. Phasellus sit amet ipsum in tellus vestibulum tincidunt. Etiam rhoncus, orci quis elementum pulvinar, leo lectus feugiat ligula, vel tincidunt massa elit eu augue. Nulla eget tortor non est ullamcorper egestas eu sit amet justo. Cras consectetur tempor dui, eget finibus orci vestibulum vitae. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia Curae; Donec faucibus mi sed turpis posuere euismod. Sed leo erat, ultricies non ligula eu, ornare consectetur justo. Donec non orci tellus. Aenean ac nibh imperdiet, sollicitudin risus eu, malesuada ante. Interdum et malesuada fames ac ante ipsum primis in faucibus. Nullam commodo sed lorem posuere lobortis. Nam a condimentum nulla, nec tempor dolor. Fusce tincidunt, mi at viverra cursus, tellus metus consequat massa, nec interdum urna ante non libero.',
          'sample-datetime': '2019-09-26',
          address: 'One World Trade Center',
          image: 'https://images.unsplash.com/photo-1542296140-47fd7d838e76',
        })
        .withField('main-image', 'string-field', 'singular', { csTitle: 'image' })
        .withField('datetime', 'string-field', 'singular', { csTitle: 'date' })
        .withField('social-link', 'string-field', 'singular', {
          csTitle: 'Follow us on Twitter',
          csDescription: 'The label will be the text displayed for the link. Use the Edit mode to set the link.',
        })
        .withField('rsvp', 'string-field', 'singular', {
          csTitle: 'RSVP',
          csDescription: 'The label will be the text displayed on the button. Use the Edit mode to set the link.',
        })
        .withField('sample-name', 'string-field', 'singular', { csTitle: 'name' })
        .withField('sample-title', 'string-field', 'singular', { csTitle: 'title' })
        .withField('sample-description', 'string-field', 'singular', { csTitle: 'description' })
        .withField('sample-datetime', 'string-field', 'singular', { csTitle: 'date' })
        .withField('address', 'string-field', 'singular', { csTitle: 'location' }).jsonapi
    );
    let card = await this.data.save(unsavedCard);
    let card2 = await this.data.save(unsavedCard);
    let card3 = await this.data.save(unsavedCard);
    return {
      card,
      card2,
      card3,
      parentCard,
      grandParentCard: await this.data.load({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'base' }, 'everything'),
      sampleName: await card.field('sample-name'),
      sampleTitle: await card.field('sample-title'),
      sampleDate: await card.field('datetime'),
      sampleLocation: await card.field('address'),
      sampleImage: await card.field('image'),
      title: await card.field('title'),
      countries: [
        { name: 'United States' },
        { name: 'Spain' },
        { name: 'Portugal' },
        { name: 'Russia' },
        { name: 'Latvia' },
        { name: 'Brazil' },
        { name: 'United Kingdom' },
      ],
    };
  }
}
