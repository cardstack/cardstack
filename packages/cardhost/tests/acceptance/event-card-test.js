import { module, skip } from 'qunit';
import { visit, currentURL } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Fixtures from '../helpers/fixtures';
import { createCards } from '../helpers/card-ui-helpers';
import { percySnapshot } from 'ember-percy';
import { setupMockUser, login } from '../helpers/login';

const eventData = [
  ['image', 'string', true, "https',//images.unsplash.com/]photo-1542296140-47fd7d838e76"],
  ['title', 'string', true, 'Quarterly Planning Meeting'],
  ['date', 'date', true, '2020-05-26'],
  ['location', 'string', true, 'One World Trade Center'],
  ['city', 'string', true, 'New York, NY'],
  ['admission', 'string', true, 'Free'],
  [
    'description',
    'string',
    true,
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Fusce sed scelerisque ex, sed elementum lorem.',
  ],
  ['cta', 'string', true, 'RSVP'],
];

const card1Id = 'event-card';
const qualifiedCard1Id = `local-hub::${card1Id}`;

const scenario = new Fixtures({
  create(factory) {
    setupMockUser(factory);
  },
  destroy() {
    return [{ type: 'cards', id: qualifiedCard1Id }];
  },
});

module('Acceptance | event card', function(hooks) {
  setupApplicationTest(hooks);
  scenario.setupTest(hooks);

  hooks.beforeEach(async function() {
    this.owner.lookup('service:data')._clearCache();
    this.owner.lookup('service:card-local-storage').clearIds();
    // Until we have searching capabilities, we'll just render the contents of the
    // local store. So the first step is to warm up the store.
    await login();
    await createCards({
      ['event-card']: eventData,
    });
    await visit(`/cards/${card1Id}`);
  });

  skip('visiting /event-card', async function(assert) {
    assert.equal(currentURL(), '/cards/event-card');
    await percySnapshot(assert);
  });
});
