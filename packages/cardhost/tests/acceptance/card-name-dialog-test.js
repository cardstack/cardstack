import { module, test } from 'qunit';
import { click, visit, currentURL } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Fixtures from '@cardstack/test-support/fixtures';
import { setCardName } from '@cardstack/test-support/card-ui-helpers';
import { setupMockUser, login } from '../helpers/login';
import { percySnapshot } from 'ember-percy';

const card1Name = 'Millenial Puppies';
const card1Id = 'millenial-puppies';
const qualifiedCard1Id = `local-hub::${card1Id}`;

const scenario = new Fixtures({
  create(factory) {
    setupMockUser(factory);
  },
  destroy() {
    return [{ type: 'cards', id: qualifiedCard1Id }];
  },
});

module('Acceptance | card name dialog', function(hooks) {
  setupApplicationTest(hooks);
  scenario.setupTest(hooks);
  hooks.beforeEach(function() {
    this.owner.lookup('service:data')._clearCache();
    this.owner.lookup('service:card-local-storage').clearIds();
  });

  test('card name dialog state is correct', async function(assert) {
    await login();
    await visit('/cards');

    assert.equal(currentURL(), '/cards');
    await click('[data-test-library-button]');
    assert.dom('[data-test-library]').exists();
    await click('[data-test-library-adopt-card-btn]');
    await percySnapshot([assert.test.module.name, assert.test.testName, 'adopt dialog'].join(' | '));
    assert.dom('[data-test-dialog-box]').exists();
    assert.dom('[data-test-dialog-box] .dialog--title').hasTextContaining('Adopt a Card');
    await click('[data-test-cancel-create-btn]'); // close dialog by clicking cancel button
    assert.dom('[data-test-dialog-box]').doesNotExist();

    await click('[data-test-library-adopt-card-btn]');
    assert.dom('[data-test-dialog-box]').exists();
    await click('[data-test-cardhost-modal-container]'); // close dialog by clicking modal container
    assert.dom('[data-test-dialog-box]').doesNotExist();

    await click('[data-test-library-new-blank-card-btn]');
    assert.dom('[data-test-dialog-box] .dialog--title').hasTextContaining('Create a New Card');
    await percySnapshot([assert.test.module.name, assert.test.testName, 'new card dialog'].join(' | '));
    await setCardName(card1Name);

    assert.equal(currentURL(), `/cards/${card1Id}/edit/fields/schema`);
    assert.dom('[data-test-field]').doesNotExist();
  });
});
