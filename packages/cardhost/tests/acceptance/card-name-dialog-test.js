import { module, skip } from 'qunit';
import { click, visit, currentURL } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Fixtures from '../helpers/fixtures';
import { setCardName } from '../helpers/card-ui-helpers';
import { login } from '../helpers/login';
import { percySnapshot } from 'ember-percy';
import { CARDSTACK_PUBLIC_REALM } from '@cardstack/core/realm';

const cardName = 'Millenial Puppies';

const scenario = new Fixtures({
  destroy: {
    cardTypes: [{ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'base' }],
  },
});

module('Acceptance | card name dialog', function(hooks) {
  setupApplicationTest(hooks);
  scenario.setupTest(hooks);

  // TODO let's get the atalog tests passing first...
  skip('card name dialog state is correct', async function(assert) {
    await login();
    await visit('/');

    assert.equal(currentURL(), '/');
    await click('[data-test-adopt-card-btn]');
    await percySnapshot([assert.test.module.name, assert.test.testName, 'adopt dialog'].join(' | '));
    assert.dom('[data-test-dialog-box]').exists();
    assert.dom('[data-test-dialog-box] .dialog--title').hasTextContaining('Adopt a Card');
    await click('[data-test-cancel-create-btn]'); // close dialog by clicking cancel button
    assert.dom('[data-test-dialog-box]').doesNotExist();

    await click('[data-test-adopt-card-btn]');
    assert.dom('[data-test-dialog-box]').exists();
    await click('[data-test-cardhost-modal-container]'); // close dialog by clicking modal container
    assert.dom('[data-test-dialog-box]').doesNotExist();

    await click('[data-test-new-blank-card-btn]');
    assert.dom('[data-test-dialog-box] .dialog--title').hasTextContaining('Create a New Card');
    await percySnapshot([assert.test.module.name, assert.test.testName, 'new card dialog'].join(' | '));
    await setCardName(cardName);

    assert.ok(currentURL().includes('/edit/fields'));
    assert.dom('[data-test-field]').doesNotExist();
  });
});
