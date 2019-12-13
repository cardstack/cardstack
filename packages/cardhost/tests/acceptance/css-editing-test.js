import { module, test } from 'qunit';
import { click, visit, currentURL, waitFor, settled } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Fixtures from '@cardstack/test-support/fixtures';
import { createCards } from '@cardstack/test-support/card-ui-helpers';
import { setupMockUser, login } from '../helpers/login';
import { percySnapshot } from 'ember-percy';

const timeout = 20000;
const card1Id = 'millenial-puppies';
const qualifiedCard1Id = `local-hub::${card1Id}`;
const cardData = {
  [card1Id]: [
    ['title', 'string', true, 'The Millenial Puppy'],
    ['author', 'string', true, 'Van Gogh'],
    [
      'body',
      'string',
      false,
      'It can be difficult these days to deal with the discerning tastes of the millenial puppy.',
    ],
  ],
};

const scenario = new Fixtures({
  create(factory) {
    setupMockUser(factory);
  },
  destroy() {
    return [{ type: 'cards', id: qualifiedCard1Id }];
  },
});

module('Acceptance | css editing', function(hooks) {
  setupApplicationTest(hooks);
  scenario.setupTest(hooks);
  hooks.beforeEach(function() {
    this.owner.lookup('service:data')._clearCache();
    // any time you visit the editor page, you need to set resizable to
    // false, or tests will time out.
    this.owner.lookup('controller:cards.view').resizable = false;
  });

  test('navigating to custom styles', async function(assert) {
    await login();
    await createCards(cardData);
    await visit(`/cards/${card1Id}`);

    await click('[data-test-mode-switcher] .ember-power-select-trigger');
    await click('[data-test-mode-switcher-mode="view"]');
    await waitFor(`[data-test-card-view="${card1Id}"]`, { timeout });

    assert.equal(currentURL(), `/cards/${card1Id}`);
    assert.dom(`[data-test-card-view="${card1Id}"]`).exists();
    await click('[data-test-card-custom-style-button]');
    assert.dom('[data-test-editor-pane]').exists();
  });

  test('closing the editor', async function(assert) {
    await login();
    await createCards(cardData);
    await click('[data-test-card-custom-style-button]');
    assert.equal(currentURL(), `/cards/${card1Id}?editingCss=true`);
    assert.dom('[data-test-close-editor]').exists();
    await click('[data-test-close-editor]');
    assert.equal(currentURL(), `/cards/${card1Id}`);
    assert.dom('[data-test-editor-pane]').doesNotExist();
    assert.dom('[data-test-card-custom-style-button]').exists();
  });

  test('hiding the editor', async function(assert) {
    await login();
    await createCards(cardData);
    await click('[data-test-card-custom-style-button]');
    await settled();
    assert.equal(currentURL(), `/cards/${card1Id}?editingCss=true`);
    assert.dom('[data-test-hide-editor-btn]').exists();
    assert.dom('[data-test-editor-pane]').exists();
    await click('[data-test-hide-editor-btn]');
    assert.dom('.cardhost-card-theme-editor.hidden').exists();
    percySnapshot(assert);
  });

  test('toggling editor docking', async function(assert) {
    await login();
    await createCards(cardData);
    await click('[data-test-card-custom-style-button]');
    assert.equal(currentURL(), `/cards/${card1Id}?editingCss=true`);
    assert.dom('[data-test-dock-bottom]').exists();
    assert.dom('[data-test-dock-location="right"]');
    percySnapshot('css editor docked right');
    await click('[data-test-dock-bottom]');
    assert.dom('[data-test-dock-location="bottom"]');
    percySnapshot('css editor docked bottom');
    await click('[data-test-dock-right]');
    assert.dom('[data-test-dock-location="right"]');
  });
});
