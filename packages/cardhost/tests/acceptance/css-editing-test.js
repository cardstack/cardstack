import { module, test } from 'qunit';
import { click, visit, currentURL, waitFor, find, settled, fillIn } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Fixtures from '@cardstack/test-support/fixtures';
import { createCards } from '@cardstack/test-support/card-ui-helpers';
import { setupMockUser, login } from '../helpers/login';
import { percySnapshot } from 'ember-percy';
import { animationsSettled } from 'ember-animated/test-support';
import { selectChoose } from 'ember-power-select/test-support';


const timeout = 2000;
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

// let animation finish before taking screenshot

const waitForAnimation = function(cb) {
  return new Promise(resolve => {
    setTimeout(() => {
      cb();
      resolve('done');
    }, 1000);
  });
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
    this.owner.lookup('service:card-local-storage').clearIds();
    // any time you visit the editor page, you need to set resizable to
    // false, or tests will time out.
    this.owner.lookup('controller:cards.card.view').resizable = false;
  });

  test('can view code editor', async function(assert) {
    await login();

    await visit(`/cards/@cardstack%2Fbase-card/edit/layout/themer`);
    assert.equal(currentURL(), `/cards/@cardstack%2Fbase-card/edit/layout/themer`);
    await waitFor(`[data-test-card-view="@cardstack/base-card"]`, { timeout });
    assert.dom('[data-test-code-block]').exists();
    await settled();
    await percySnapshot(assert);
  });

  test('can dock code editor to bottom', async function(assert) {
    await login();

    await visit(`/cards/@cardstack%2Fbase-card/edit/layout/themer`);
    assert.equal(currentURL(), `/cards/@cardstack%2Fbase-card/edit/layout/themer`);
    await waitFor(`[data-test-card-view="@cardstack/base-card"]`, { timeout });
    assert.dom('[data-test-code-block]').exists();
    await settled();
    assert.dom('.cardhost-card-theme-editor').hasAttribute('data-test-dock-location', 'right');
    await click('[data-test-dock-bottom]');
    assert.dom('.cardhost-card-theme-editor').hasAttribute('data-test-dock-location', 'bottom');
    await percySnapshot(assert);
  });

  test('check that card name is stable so we can use it for themer styling', async function(assert) {
    await login();
    await createCards(cardData);
    await visit(`/cards/${card1Id}`);
    assert.dom('.millenial-puppies').exists();
  });

  test('navigating to custom styles', async function(assert) {
    await login();
    await createCards(cardData);
    await visit(`/cards/${card1Id}`);

    await click('[data-test-card-edit-link]');
    await waitFor(`[data-test-card-edit="${card1Id}"]`, { timeout });

    assert.equal(currentURL(), `/cards/${card1Id}/edit/fields`);

    await click('[data-test-view-selector="layout"]');
    await waitFor(`[data-test-card-view="${card1Id}"]`, { timeout });

    assert.equal(currentURL(), `/cards/${card1Id}/edit/layout`);
    assert.dom(`[data-test-card-view="${card1Id}"]`).exists();
    assert.dom('[data-test-card-renderer-isolated]').hasClass('selected');
    await click('[data-test-card-custom-style-button]');
    assert.dom('[data-test-editor-pane]').exists();
    assert.dom('[data-test-card-renderer-isolated]').doesNotHaveClass('selected');
  });

  test('closing the editor', async function(assert) {
    await login();
    await createCards(cardData);
    await visit(`/cards/${card1Id}/edit/layout`);
    await click('[data-test-card-custom-style-button]');
    assert.equal(currentURL(), `/cards/${card1Id}/edit/layout/themer`);
    assert.dom('[data-test-close-editor]').exists();
    assert.dom('[data-test-card-renderer-isolated]').doesNotHaveClass('selected');
    await click('[data-test-close-editor]');
    assert.equal(currentURL(), `/cards/${card1Id}/edit/layout`);
    assert.dom('[data-test-editor-pane]').doesNotExist();
    assert.dom('[data-test-card-custom-style-button]').exists();
    assert.dom('[data-test-card-renderer-isolated]').hasClass('selected');
  });

  test('hiding the editor', async function(assert) {
    await login();
    await createCards(cardData);
    await visit(`/cards/${card1Id}/edit/layout`);
    await click('[data-test-card-custom-style-button]');
    await settled();
    assert.equal(currentURL(), `/cards/${card1Id}/edit/layout/themer`);
    assert.dom('[data-test-hide-editor-btn]').exists();
    assert.dom('[data-test-editor-pane]').exists();
    await click('[data-test-hide-editor-btn]');
    assert.dom('.cardhost-card-theme-editor.hidden').exists();
    await waitForAnimation(() => percySnapshot(assert));
  });

  test('toggling editor docking', async function(assert) {
    await login();
    await createCards(cardData);
    await visit(`/cards/${card1Id}/edit/layout`);
    await click('[data-test-card-custom-style-button]');
    assert.equal(currentURL(), `/cards/${card1Id}/edit/layout/themer`);
    assert.dom('[data-test-dock-bottom]').exists();
    assert.dom('[data-test-dock-location="right"]');
    await waitForAnimation(() => percySnapshot('css editor docked right'));
    await click('[data-test-dock-bottom]');
    assert.dom('[data-test-dock-location="bottom"]');
    await waitForAnimation(() => percySnapshot('css editor docked bottom'));
    await click('[data-test-dock-right]');
    assert.dom('[data-test-dock-location="right"]');
  });

  test('toggling card width', async function(assert) {
    await login();
    await createCards(cardData);
    await visit(`/cards/${card1Id}/edit/layout`);
    await click('[data-test-card-custom-style-button]');
    assert.equal(currentURL(), `/cards/${card1Id}/edit/layout/themer`);
    // make sure initial state is correct
    assert.dom('[data-test-responsive-btn]').exists();
    assert.dom('[data-test-responsive-btn]').hasClass('selected');
    assert.dom('[data-test-full-width-btn]').exists();
    assert.dom('[data-test-full-width-btn]').doesNotHaveClass('selected');
    assert.dom('[data-test-cardhost-cards]').hasClass('responsive');
    // toggle to full width
    await click('[data-test-full-width-btn]');
    assert.dom('[data-test-full-width-btn]').hasClass('selected');
    assert.dom('[data-test-cardhost-cards]').hasClass('full-width');
    await waitForAnimation(() => percySnapshot(assert));
  });

  test('can save CSS edits', async function(assert) {
    await login();
    await createCards(cardData);
    await visit(`/cards/${card1Id}/edit/layout`);
    await click('[data-test-card-custom-style-button]');
    await waitFor('[data-test-editor-pane] textarea');
    await fillIn('[data-test-editor-pane] textarea', 'gorgeous styles');
    let themerHasStyle = find('[data-test-preview-css]').innerText.includes('gorgeous styles');
    assert.ok(themerHasStyle);
    await click('[data-test-card-save-btn]');
    await waitFor(`[data-test-card-save-btn].saved`, { timeout });
    await animationsSettled();
    let viewHasStyle = find('[data-test-view-css]').innerText.includes('gorgeous styles');
    assert.ok(viewHasStyle);
  });

  test('dropdown displays default theme for new cards', async function(assert) {
    await login();
    await createCards(cardData);
    assert.equal(currentURL(), `/cards/${card1Id}/edit/layout`);
    assert.dom('data-test-cs-component="dropdown"').exists();
    assert.dom('data-test-cs-component="dropdown"').hasText('default');
    assert.dom('data-test-cs-component="dropdown"').doesNotHaveText('custom');
  });

  test('dropdown displays custom theme for cards with custom CSS', async function(assert) {
    await login();
    await createCards(cardData);
    assert.equal(currentURL(), `/cards/${card1Id}/edit/layout`);
    await click('[data-test-card-custom-style-button]');
    await waitFor('[data-test-editor-pane] textarea');
    await fillIn('[data-test-editor-pane] textarea', 'gorgeous styles');
    await click('[data-test-close-editor]');
    assert.dom('data-test-cs-component="dropdown"').exists();
    assert.dom('data-test-cs-component="dropdown"').hasText('custom');
    assert.dom('data-test-cs-component="dropdown"').doesNotHaveText('default');
  });

  test('selecting default theme resets css', async function(assert) {
    await login();
    await createCards(cardData);
    assert.equal(currentURL(), `/cards/${card1Id}/edit/layout`);
    await click('[data-test-card-custom-style-button]');
    await waitFor('[data-test-editor-pane] textarea');
    await fillIn('[data-test-editor-pane] textarea', 'gorgeous styles');
    await click('[data-test-close-editor]');
    await click('[data-test-card-save-btn]');
    await waitFor(`[data-test-card-save-btn].saved`, { timeout });
    await selectChoose('data-test-cs-component="dropdown"', 'Cardstack default');
    assert.dom('data-test-cs-component="dropdown"').doesNotContainText('custom');
    assert.dom('[data-test-view-css]').doesNotContainText('gorgeous styles');
  });
});
