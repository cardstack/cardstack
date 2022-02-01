import { module, test } from 'qunit';
import { visit, currentURL } from '@ember/test-helpers';
import {
  ADDRESS_RAW_CARD,
  PERSON_RAW_CARD,
} from '@cardstack/core/tests/helpers/fixtures';
import { LOCAL_REALM } from 'cardhost/lib/builder';
import { cardURL } from '@cardstack/core/src/utils';
import { setupCardTest } from '../helpers/setup';

module('Acceptance | card routing', function (hooks) {
  let personURL = cardURL(PERSON_RAW_CARD);
  let routeCardURL = `${LOCAL_REALM}my-routes`;

  let { createCard } = setupCardTest(hooks, {
    type: 'application',
    routingCard: routeCardURL,
  });

  hooks.beforeEach(async function () {
    await createCard({
      id: 'my-routes',
      realm: LOCAL_REALM,
      schema: 'schema.js',
      files: {
        'schema.js': `
          export default class MyRoutes {
            routeTo(path) {
              if (path === '/welcome') {
                return '${personURL}';
              }
            }
          }`,
      },
    });

    await createCard(ADDRESS_RAW_CARD);
    await createCard(
      Object.assign({ data: { name: 'Arthur' } }, PERSON_RAW_CARD)
    );
  });

  test('visiting /card-routing', async function (assert) {
    await visit('/welcome');
    assert.equal(currentURL(), '/welcome');
    assert.equal(
      document.head.querySelector(
        `[data-asset-url="@cardstack/local-realm-compiled/https-cardstack.local-person/isolated.css"]`
      )?.innerHTML,
      '.person-isolated { background: red }'
    );
    assert.dom('[data-test-person]').containsText('Hi! I am Arthur');
  });
});
