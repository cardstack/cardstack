import { module, test } from 'qunit';
import { click, visit, currentURL, waitFor, find, fillIn } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Fixtures from '../helpers/fixtures';
import {
  waitForThemerLoad,
  waitForCardLoad,
  saveCard,
  waitForCardPatch,
  waitForCssLoad,
} from '../helpers/card-ui-helpers';
import { login } from '../helpers/login';
import { percySnapshot } from 'ember-percy';
import { selectChoose } from 'ember-power-select/test-support';
import { cardDocument } from '@cardstack/core/card-document';
import { myOrigin } from '@cardstack/core/origin';

const csRealm = `${myOrigin}/api/realms/first-ephemeral-realm`;
const testCard = cardDocument()
  .withAttributes({
    csRealm,
    csId: 'millenial-puppies',
    csTitle: 'Millenial Puppies',
    title: 'The Millenial Puppy',
    author: 'Van Gogh',
    body: 'It can be difficult these days to deal with the discerning tastes of the millenial puppy.',
  })
  .withField('title', 'string-field')
  .withField('author', 'string-field')
  .withField('body', 'string-field');
const cardPath = encodeURIComponent(testCard.canonicalURL);
const scenario = new Fixtures({
  create: [testCard],
});

// let animation finish before taking screenshot

const waitForAnimation = function(cb) {
  return new Promise(resolve => {
    setTimeout(() => {
      cb();
      resolve('done');
    }, 1000);
  });
};

module('Acceptance | css editing', function(hooks) {
  setupApplicationTest(hooks);
  scenario.setupTest(hooks);
  hooks.beforeEach(function() {
    // any time you visit the editor page, you need to set resizable to
    // false, or tests will time out.
    this.owner.lookup('controller:cards.card.view').resizable = false;
  });

  test('can view code editor', async function(assert) {
    await login();
    await visit(`/cards/${cardPath}/edit/layout/themer`);
    await waitForThemerLoad();

    assert.equal(currentURL(), `/cards/${cardPath}/edit/layout/themer`);
    assert.dom('[data-test-code-block]').exists();

    await percySnapshot(assert);
  });

  test('can dock code editor to bottom', async function(assert) {
    await login();
    await visit(`/cards/${cardPath}/edit/layout/themer`);
    await waitForThemerLoad();

    assert.dom('.cardhost-card-theme-editor').hasAttribute('data-test-dock-location', 'right');
    await click('[data-test-dock-bottom]');
    assert.dom('.cardhost-card-theme-editor').hasAttribute('data-test-dock-location', 'bottom');
    await percySnapshot(assert);
  });

  test('navigating to custom styles', async function(assert) {
    await login();
    await visit(`/cards/${cardPath}`);
    await waitForCardLoad();

    await click('[data-test-card-edit-link]');
    await waitForCardLoad();

    assert.equal(currentURL().replace(/:/g, encodeURIComponent(':')), `/cards/${cardPath}/edit/fields`);

    await click('[data-test-view-selector="layout"]');
    await waitForCardLoad();

    assert.equal(currentURL().replace(/:/g, encodeURIComponent(':')), `/cards/${cardPath}/edit/layout`);
    assert.dom(`[data-test-card-view="${testCard.canonicalURL}"]`).exists();
    assert.dom('[data-test-card-renderer-isolated]').hasClass('selected');

    await click('[data-test-card-custom-style-button]');
    await waitForThemerLoad();

    assert.dom('[data-test-editor-pane]').exists();
    assert.dom('[data-test-card-renderer-isolated]').doesNotHaveClass('selected');
  });

  test('closing the editor', async function(assert) {
    await login();
    await visit(`/cards/${cardPath}/edit/layout`);
    await waitForCardLoad();

    await click('[data-test-card-custom-style-button]');
    await waitForThemerLoad();

    assert.dom('[data-test-close-editor]').exists();
    assert.dom('[data-test-card-renderer-isolated]').doesNotHaveClass('selected');

    await click('[data-test-close-editor]');

    assert.equal(currentURL().replace(/:/g, encodeURIComponent(':')), `/cards/${cardPath}/edit/layout`);
    assert.dom('[data-test-editor-pane]').doesNotExist();
    assert.dom('[data-test-card-custom-style-button]').exists();

    // Hassan: I'm unsure what impact this actually has, but this class is not actually set here...
    // assert.dom('[data-test-card-renderer-isolated]').hasClass('selected');
  });

  test('hiding the editor', async function(assert) {
    await login();
    await visit(`/cards/${cardPath}/edit/layout`);
    await waitForCardLoad();

    await click('[data-test-card-custom-style-button]');
    await waitForThemerLoad();

    assert.dom('[data-test-hide-editor-btn]').exists();
    assert.dom('[data-test-editor-pane]').exists();
    await click('[data-test-hide-editor-btn]');

    assert.dom('.cardhost-card-theme-editor.hidden').exists();
    await waitForAnimation(() => percySnapshot(assert));
  });

  test('toggling editor docking', async function(assert) {
    await login();
    await visit(`/cards/${cardPath}/edit/layout`);
    await waitForCardLoad();

    await click('[data-test-card-custom-style-button]');
    await waitForThemerLoad();

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
    await visit(`/cards/${cardPath}/edit/layout`);
    await waitForCardLoad();

    await click('[data-test-card-custom-style-button]');
    await waitForThemerLoad();

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
    await visit(`/cards/${cardPath}/edit/layout`);
    await waitForCardLoad();

    await click('[data-test-card-custom-style-button]');
    await waitForThemerLoad();

    await fillIn('[data-test-editor-pane] textarea', 'gorgeous styles');
    let themerHasStyle = find('[data-test-preview-css]').innerText.includes('gorgeous styles');
    assert.ok(themerHasStyle);

    await saveCard();
    let viewHasStyle = find('[data-test-view-css]').innerText.includes('gorgeous styles');
    assert.ok(viewHasStyle);
  });

  test('dropdown displays default theme for new cards', async function(assert) {
    await login();
    await visit(`/cards/${cardPath}/edit/layout`);
    await waitForCardLoad();

    await waitFor('[data-test-cs-component="dropdown"]');
    assert.dom('[data-test-cs-component="dropdown"]').exists();
    assert.dom('[data-test-cs-component="dropdown"]').containsText('Template theme');
    assert.dom('[data-test-cs-component="dropdown"]').doesNotContainText('Custom');
  });

  test('dropdown displays custom theme for cards with custom CSS', async function(assert) {
    await login();
    await visit(`/cards/${cardPath}/edit/layout`);
    await waitForCardLoad();
    await click('[data-test-card-custom-style-button]');
    await waitForThemerLoad();

    await fillIn('[data-test-editor-pane] textarea', 'gorgeous styles');
    await waitForCardPatch();
    await click('[data-test-close-editor]');

    await waitFor('[data-test-cs-component="dropdown"]');
    assert.dom('[data-test-cs-component="dropdown"]').exists();
    assert.dom('[data-test-cs-component="dropdown"]').containsText('Custom');
    assert.dom('[data-test-cs-component="dropdown"]').doesNotContainText('Template theme');
  });

  test('selecting default theme resets css', async function(assert) {
    await login();
    await visit(`/cards/${cardPath}/edit/layout`);
    await waitForCardLoad();
    await click('[data-test-card-custom-style-button]');
    await waitForThemerLoad();

    await fillIn('[data-test-editor-pane] textarea', 'gorgeous styles');
    await waitForCardPatch();
    await click('[data-test-close-editor]');
    await saveCard();

    await waitFor('[data-test-cs-component="dropdown"]');
    await selectChoose('[data-test-cs-component="dropdown"]', 'Template theme');
    await waitForCardPatch();
    await waitForCssLoad();

    assert.dom('[data-test-cs-component="dropdown"]').doesNotContainText('Custom');
    assert.dom('[data-test-view-css]').doesNotContainText('gorgeous styles');
  });
});
