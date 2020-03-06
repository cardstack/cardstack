import { module, test } from 'qunit';
import { click, visit, currentURL, triggerKeyEvent, fillIn } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Fixtures from '../helpers/fixtures';
import {
  setCardName,
  waitForCatalogEntriesToLoad,
  waitForCardLoad,
  showCardId,
  waitForSchemaViewToLoad,
  waitForTestsToEnd,
} from '../helpers/card-ui-helpers';
import { login } from '../helpers/login';
import { percySnapshot } from 'ember-percy';
import { CARDSTACK_PUBLIC_REALM } from '@cardstack/core/realm';
import { cardDocument } from '@cardstack/core/card-document';

const cardName = 'Millenial Puppies';

const csRealm = 'https://cardstack.com/api/realms/card-catalog';
const parentCard = cardDocument()
  .withAttributes({
    csRealm,
    csId: 'user-card',
    csTitle: 'User Card',
    csFieldSets: {
      embedded: ['name'],
      isolated: ['name'],
    },
  })
  .withField('name', 'string-field');
const entry = cardDocument()
  .withAttributes({
    csRealm,
    csId: 'entry',
    csTitle: 'User Template',
    csDescription: 'This is a template for creating users',
    type: 'template',
  })
  .withRelationships({ card: parentCard })
  .adoptingFrom({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'catalog-entry' });
const scenario = new Fixtures({
  create: [parentCard, entry],
  destroy: {
    cardTypes: [{ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'base' }],
  },
});

async function waitForTemplatesToLoad() {
  await waitForCatalogEntriesToLoad('[data-test-templates]');
}

module('Acceptance | card name dialog', function(hooks) {
  setupApplicationTest(hooks);
  scenario.setupTest(hooks);
  hooks.beforeEach(async function() {
    await login();
  });
  hooks.afterEach(async function() {
    await waitForTestsToEnd();
  });

  test('can create a card that uses a template from the catalog', async function(assert) {
    await visit('/cards');
    await click('[data-test-library-button]');
    await waitForTemplatesToLoad();

    await click('[data-test-library-adopt-card-btn]');
    await percySnapshot([assert.test.module.name, assert.test.testName, 'adopt dialog'].join(' | '));
    assert.dom('[data-test-dialog-box]').exists();
    assert.dom('[data-test-dialog-box] .dialog--title').hasTextContaining('Adopt a Card');

    await setCardName(cardName);
    await waitForCardLoad();
    await showCardId();
    assert.dom('.card-renderer-isolated--header-title').hasText(cardName);
    assert.ok(currentURL().includes('/edit/fields'));
    assert.dom('[data-test-right-edge] [data-test-adopted-card-name]').hasText('User Card');
    assert.dom('[data-test-right-edge] [data-test-adopted-card-adopted-card-name]').hasText('Base Card');
    assert.dom('[data-test-isolated-card] [data-test-field="name"]').exists();
  });

  test('can create a new card that does not leverage a template from the catalog', async function(assert) {
    await visit('/cards');
    await click('[data-test-library-button]');
    await waitForTemplatesToLoad();

    await click('[data-test-library-new-blank-card-btn]');
    assert.dom('[data-test-dialog-box] .dialog--title').hasTextContaining('Create a New Card');
    await percySnapshot([assert.test.module.name, assert.test.testName, 'new card dialog'].join(' | '));
    await setCardName(cardName);

    await waitForCardLoad();
    await showCardId();
    assert.dom('.card-renderer-isolated--header-title').hasText(cardName);
    assert.ok(currentURL().includes('/edit/fields'));
    assert.dom('[data-test-right-edge] [data-test-adopted-card-name]').hasText('Base Card');
    assert.dom('[data-test-isolated-card] [data-test-field]').doesNotExist();
  });

  test('can use the enter key to confirm card name from dialog', async function(assert) {
    await visit('/cards');
    await click('[data-test-library-button]');
    await waitForTemplatesToLoad();

    await click('[data-test-library-new-blank-card-btn]');
    await fillIn('#card__name', cardName);
    await triggerKeyEvent('#card__name', 'keydown', 'Enter');
    await waitForSchemaViewToLoad();

    assert.dom('.card-renderer-isolated--header-title').hasText(cardName);
  });

  test('can cancel creation of a card by clicking outside the dialog', async function(assert) {
    await visit('/cards');
    await click('[data-test-library-button]');
    await waitForTemplatesToLoad();

    await click('[data-test-library-adopt-card-btn]');
    await click('[data-test-cardhost-modal-container]'); // close dialog by clicking modal container
    assert.dom('[data-test-dialog-box]').doesNotExist();
    assert.equal(currentURL(), '/cards');
  });

  test('can cancel creation of a card by clicking the cancel button', async function(assert) {
    await visit('/cards');
    await click('[data-test-library-button]');
    await waitForTemplatesToLoad();

    await click('[data-test-library-adopt-card-btn]');
    await click('[data-test-cancel-create-btn]'); // close dialog by clicking cancel button
    assert.dom('[data-test-dialog-box]').doesNotExist();
    assert.equal(currentURL(), '/cards');
  });
});
