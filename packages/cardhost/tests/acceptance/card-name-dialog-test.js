import { module, test } from 'qunit';
import { click, visit, currentURL } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Fixtures from '../helpers/fixtures';
import { setCardName, waitForTemplatesLoad, waitForCardLoad, showCardId } from '../helpers/card-ui-helpers';
import { login } from '../helpers/login';
import { percySnapshot } from 'ember-percy';
import { CARDSTACK_PUBLIC_REALM } from '@cardstack/core/realm';
import { cardDocument } from '@cardstack/core/card-document';
import { myOrigin } from '@cardstack/core/origin';

const cardName = 'Millenial Puppies';

const csRealm = `${myOrigin}/api/realms/first-ephemeral-realm`;
const parentCard = cardDocument()
  .withAttributes({
    csRealm,
    csId: 'user-card',
    csTitle: 'User Card',
  })
  .withField('name', 'string-field');
const entry = cardDocument()
  .withAttributes({
    csRealm,
    csId: 'entry',
    csTitle: 'User Template',
    csDescription: 'This is a template for creating users',
    csFieldSets: {
      embedded: ['card'],
    },
  })
  .withRelationships({ card: parentCard })
  .adoptingFrom({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'catalog-entry' });
const scenario = new Fixtures({
  create: [parentCard, entry],
  destroy: {
    cardTypes: [{ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'base' }],
  },
});

module('Acceptance | card name dialog', function(hooks) {
  setupApplicationTest(hooks);
  scenario.setupTest(hooks);
  hooks.beforeEach(async function() {
    await login();
  });

  test('can create a card that uses a template from the catalog', async function(assert) {
    await visit('/');
    await click('[data-test-library-button]');
    await waitForTemplatesLoad();

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
    await visit('/');
    await click('[data-test-library-button]');
    await waitForTemplatesLoad();

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

  test('can cancel creation of a card by clicking outside the dialog', async function(assert) {
    await visit('/');
    await click('[data-test-library-button]');
    await waitForTemplatesLoad();

    await click('[data-test-library-adopt-card-btn]');
    await click('[data-test-cardhost-modal-container]'); // close dialog by clicking modal container
    assert.dom('[data-test-dialog-box]').doesNotExist();
    assert.equal(currentURL(), '/');
  });

  test('can cancel creation of a card by clicking the cancel button', async function(assert) {
    await visit('/');
    await click('[data-test-library-button]');
    await waitForTemplatesLoad();

    await click('[data-test-library-adopt-card-btn]');
    await click('[data-test-cancel-create-btn]'); // close dialog by clicking cancel button
    assert.dom('[data-test-dialog-box]').doesNotExist();
    assert.equal(currentURL(), '/');
  });
});
