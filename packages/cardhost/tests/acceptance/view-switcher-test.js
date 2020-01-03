import { module, test } from 'qunit';
import { click, visit, currentURL, waitFor } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Fixtures from '@cardstack/test-support/fixtures';
import { createCards } from '@cardstack/test-support/card-ui-helpers';
import { setupMockUser, login } from '../helpers/login';

const timeout = 20000;
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

module('Acceptance | view switcher', function(hooks) {
  setupApplicationTest(hooks);
  scenario.setupTest(hooks);
  hooks.beforeEach(function() {
    this.owner.lookup('service:data')._clearCache();
  });

  test(`initially displays the right selection`, async function(assert) {
    await login();
    await createCards({
      [card1Id]: [['body', 'string', false, 'test body']],
    });

    await visit(`/cards/${card1Id}/edit`);
    await waitFor(`[data-test-card-edit="${card1Id}"]`, { timeout });

    assert.equal(currentURL(), `/cards/${card1Id}/edit`);
    assert.dom(`[data-test-mode-switcher] .ember-power-select-selected-item`).hasText('Edit View');

    await visit(`/cards/${card1Id}/schema`);
    await waitFor(`[data-test-card-schema="${card1Id}"]`, { timeout });

    assert.equal(currentURL(), `/cards/${card1Id}/schema`);
    assert.dom(`[data-test-mode-switcher] .ember-power-select-selected-item`).hasText('Schema View');

    await visit(`/cards/${card1Id}`);
    await waitFor(`[data-test-card-view="${card1Id}"]`, { timeout });

    assert.equal(currentURL(), `/cards/${card1Id}`);
    assert.dom(`[data-test-mode-switcher] .ember-power-select-selected-item`).hasText('Layout View');
  });

  test(`can navigate to card editor`, async function(assert) {
    await login();
    await createCards({
      [card1Id]: [['body', 'string', false, 'test body']],
    });
    await visit(`/cards/${card1Id}/schema`);
    await click('[data-test-mode-switcher] .ember-power-select-trigger');
    await click('[data-test-mode-switcher-mode="edit"]');
    await waitFor(`[data-test-card-edit="${card1Id}"]`, { timeout });

    assert.equal(currentURL(), `/cards/${card1Id}/edit`);
    assert.dom(`[data-test-mode-switcher] .ember-power-select-selected-item`).hasText('Edit View');
    assert.dom(`[data-test-card-edit="${card1Id}"]`).exists();
  });

  test(`can navigate to card view`, async function(assert) {
    await login();
    await createCards({
      [card1Id]: [['body', 'string', false, 'test body']],
    });
    await visit(`/cards/${card1Id}/schema`);
    await click('[data-test-mode-switcher] .ember-power-select-trigger');
    await click('[data-test-mode-switcher-mode="view"]');
    await waitFor(`[data-test-card-view="${card1Id}"]`, { timeout });

    assert.equal(currentURL(), `/cards/${card1Id}`);
    assert.dom(`[data-test-mode-switcher] .ember-power-select-selected-item`).hasText('Layout View');
    assert.dom(`[data-test-card-view="${card1Id}"]`).exists();
  });
});
