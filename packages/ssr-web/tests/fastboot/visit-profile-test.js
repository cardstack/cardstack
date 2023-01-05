import { module, test } from 'qunit';
import {
  setup,
  visit,
  mockServer,
} from 'ember-cli-fastboot-testing/test-support';

module('FastBoot | profile', function (hooks) {
  setup(hooks);

  test('it renders a profile', async function (assert) {
    await mockServer.get('http://example.com/api/profiles/mandello', {
      meta: { network: 'sokol' },
      data: {
        id: 'db7d5245-15be-4c24-9392-e5316387c5e4',
        type: 'profiles',
        attributes: {
          did: 'did:cardstack:1mt71bPkVWeYvtYeTYm1KYMs1bac6b07ffedfbc0',
          name: 'mandello',
          slug: 'mandello',
          color: '#daffb3',
          'text-color': '#000000',
          'owner-address': '0x323B2318F35c6b31113342830204335Dac715AA8',
          links: [],
          'profile-description': null,
          'profile-image-url': null,
        },
      },
    });

    await visit('/', { headers: { host: 'mandello.card.xyz.localhost' } });
    assert.dom('[data-test-profile-name]').hasText('mandello');
  });
});
