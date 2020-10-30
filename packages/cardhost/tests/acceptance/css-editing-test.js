import { module, test } from 'qunit';
import { click, visit, currentURL, waitFor, find, fillIn } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Fixtures from '../helpers/fixtures';
import {
  waitForThemerLoad,
  waitForCardLoad,
  saveCard,
  waitForCardPatch,
  encodeColons,
  waitForCardAutosave,
  waitForTestsToEnd,
  getCardIdFromURL,
  getEncodedCardIdFromURL,
  waitForAnimation,
  CARDS_URL,
} from '../helpers/card-ui-helpers';
import { login } from '../helpers/login';
import { percySnapshot } from 'ember-percy';
import { selectChoose } from 'ember-power-select/test-support';
import { cardDocument } from '@cardstack/hub';
import { isolatedCssFile } from '@cardstack/cardhost/utils/scaffolding';

const csRealm = `http://localhost:3000/api/realms/default`;
const parentCard = cardDocument()
  .withAttributes({
    csRealm,
    csId: 'parent-card',
    csTitle: 'Parent Card',
    csFeatures: { 'isolated-css': isolatedCssFile },
    csFiles: {
      [isolatedCssFile]: 'base css',
    },
    csFieldSets: {
      isolated: ['title', 'author', 'body'],
    },
  })
  .withField('title', 'string-field')
  .withField('author', 'string-field')
  .withField('body', 'string-field');
const testCard = cardDocument()
  .withAttributes({
    csRealm,
    csId: 'millenial-puppies',
    csTitle: 'Millenial Puppies',
    title: 'The Millenial Puppy',
    author: 'Van Gogh',
    body: 'It can be difficult these days to deal with the discerning tastes of the millenial puppy.',
  })
  .adoptingFrom(parentCard);
const cardPath = encodeURIComponent(testCard.canonicalURL);
const scenario = new Fixtures({
  create: [parentCard, testCard],
});

// If the chrome browser window doesn't have focus while running these tests,
// then you'll get false test failures. I think there might be some kind of
// monaco depedency on having the chrome browser have focus in order for the CSS
// to bet set correctly.
module('Acceptance | css editing (make sure browser window has focus!)', function(hooks) {
  setupApplicationTest(hooks);
  scenario.setupTest(hooks);
  hooks.beforeEach(async function() {
    // any time you visit the editor page, you need to set resizable to
    // false, or tests will time out.
    this.owner.lookup('controller:cards.card.view').resizable = false;
    await login();
  });
  hooks.afterEach(async function() {
    await waitForTestsToEnd();
  });

  test('can view code editor', async function(assert) {
    await visit(`${CARDS_URL}/${cardPath}/configure/layout/themer`);
    await waitForThemerLoad();

    assert.equal(currentURL(), `${CARDS_URL}/${cardPath}/configure/layout/themer`);
    assert.dom('[data-test-code-block]').exists();

    await percySnapshot(assert);
  });

  test('can dock code editor to bottom', async function(assert) {
    await visit(`${CARDS_URL}/${cardPath}/configure/layout/themer`);
    await waitForThemerLoad();

    assert.dom('.cardhost-card-theme-editor').hasAttribute('data-test-dock-location', 'right');
    await click('[data-test-dock-bottom]');
    assert.dom('.cardhost-card-theme-editor').hasAttribute('data-test-dock-location', 'bottom');
    await percySnapshot(assert);
  });

  test('navigating to custom styles', async function(assert) {
    // TODO: start at /cards route and use dropdown menu nav
    await visit(`${CARDS_URL}/${cardPath}/configure/layout`);
    await waitForCardLoad();

    assert.equal(encodeColons(currentURL()), `${CARDS_URL}/${cardPath}/configure/layout`);
    assert.dom(`[data-test-card-view="${testCard.canonicalURL}"]`).exists();

    await click('[data-test-card-custom-style-button]');
    await waitForThemerLoad();

    assert.dom('[data-test-editor-pane]').exists();
  });

  test('closing the editor', async function(assert) {
    await visit(`${CARDS_URL}/${cardPath}/configure/layout`);
    await waitForCardLoad();

    await click('[data-test-card-custom-style-button]');
    await waitForThemerLoad();

    assert.dom('[data-test-mode-indicator-link="themer"]').exists();
    await click('[data-test-mode-indicator-link="themer"]');
    await waitForCardLoad();

    assert.equal(encodeColons(currentURL()), `${CARDS_URL}/${cardPath}/configure/layout`);
    assert.dom('[data-test-editor-pane]').doesNotExist();
    assert.dom('[data-test-card-custom-style-button]').exists();
  });

  test('toggling editor docking', async function(assert) {
    await visit(`${CARDS_URL}/${cardPath}/configure/layout`);
    await waitForCardLoad();

    await click('[data-test-card-custom-style-button]');
    await waitForThemerLoad();

    assert.dom('[data-test-dock-bottom]').exists();
    assert.dom('[data-test-dock-location="right"]');
    await waitForAnimation(async () => await percySnapshot('css editor docked right'));

    await click('[data-test-dock-bottom]');
    assert.dom('[data-test-dock-location="bottom"]');
    await waitForAnimation(async () => await percySnapshot('css editor docked bottom'));

    await click('[data-test-dock-right]');
    assert.dom('[data-test-dock-location="right"]');
  });

  test('themer mode: toggling card width', async function(assert) {
    await visit(`${CARDS_URL}/${cardPath}/configure/layout`);
    await waitForCardLoad();

    await click('[data-test-card-custom-style-button]');
    await waitForThemerLoad();
    await click('[data-test-dock-bottom]'); // dock to bottom so we can see better in Percy Screnshots

    // make sure initial state is correct
    assert.dom('[data-test-small-btn]').exists();
    assert.dom('[data-test-small-btn]').doesNotHaveClass('selected');
    assert.dom('[data-test-medium-btn]').exists();
    assert.dom('[data-test-medium-btn]').hasClass('selected');
    assert.dom('[data-test-large-btn]').exists();
    assert.dom('[data-test-large-btn]').doesNotHaveClass('selected');
    assert.dom('[data-test-cardhost-cards]').hasClass('themer-card-width--medium');

    // toggle to full width
    await click('[data-test-large-btn]');
    assert.dom('[data-test-large-btn]').hasClass('selected');
    assert.dom('[data-test-cardhost-cards]').hasClass('themer-card-width--large');
    assert.dom('[data-test-small-btn]').doesNotHaveClass('selected');
    assert.dom('[data-test-medium-btn]').doesNotHaveClass('selected');
    await waitForAnimation(async () => await percySnapshot('themer - large card width'));

    await click('[data-test-small-btn]');
    assert.dom('[data-test-large-btn]').doesNotHaveClass('selected');
    assert.dom('[data-test-cardhost-cards]').hasClass('themer-card-width--small');
    assert.dom('[data-test-small-btn]').hasClass('selected');
    assert.dom('[data-test-medium-btn]').doesNotHaveClass('selected');
    await waitForAnimation(async () => await percySnapshot('themer - small card width'));
  });

  test('layout mode: toggling card width', async function(assert) {
    await visit(`${CARDS_URL}/${cardPath}/configure/layout`);
    await waitForCardLoad();

    assert.dom('[data-test-small-btn]').exists();
    assert.dom('[data-test-small-btn]').doesNotHaveClass('selected');
    assert.dom('[data-test-medium-btn]').exists();
    assert.dom('[data-test-medium-btn]').hasClass('selected');
    assert.dom('[data-test-large-btn]').exists();
    assert.dom('[data-test-large-btn]').doesNotHaveClass('selected');
    assert.dom('[data-test-cardhost-cards]').hasClass('themer-card-width--medium');
    await waitForAnimation(async () => await percySnapshot('layout - medium card width'));

    // toggle to full width
    await click('[data-test-small-btn]');
    assert.dom('[data-test-small-btn]').hasClass('selected');
    assert.dom('[data-test-cardhost-cards]').hasClass('themer-card-width--small');
    assert.dom('[data-test-medium-btn]').doesNotHaveClass('selected');
    assert.dom('[data-test-large-btn]').doesNotHaveClass('selected');
    await waitForAnimation(async () => await percySnapshot('layout - small card width'));

    await click('[data-test-large-btn]');
    assert.dom('[data-test-large-btn]').hasClass('selected');
    assert.dom('[data-test-cardhost-cards]').hasClass('themer-card-width--large');
    assert.dom('[data-test-small-btn]').doesNotHaveClass('selected');
    assert.dom('[data-test-medium-btn]').doesNotHaveClass('selected');
    await waitForAnimation(async () => await percySnapshot('layout - large card width'));
  });

  test('changing card size should change card size in both themer and preview modes', async function(assert) {
    await visit(`${CARDS_URL}/${cardPath}/configure/layout/themer`);
    await waitForThemerLoad();
    let cardId = getEncodedCardIdFromURL();

    assert.dom('[data-test-small-btn]').doesNotHaveClass('selected');
    assert.dom('[data-test-medium-btn]').hasClass('selected');
    assert.dom('[data-test-large-btn]').doesNotHaveClass('selected');

    await click('[data-test-small-btn]');
    assert.dom('[data-test-small-btn]').hasClass('selected');
    assert.dom('[data-test-medium-btn]').doesNotHaveClass('selected');
    assert.dom('[data-test-large-btn]').doesNotHaveClass('selected');

    await click('[data-test-mode-indicator-link="themer"]');
    await waitForCardLoad();

    assert.dom('[data-test-small-btn]').hasClass('selected');
    assert.dom('[data-test-medium-btn]').doesNotHaveClass('selected');
    assert.dom('[data-test-large-btn]').doesNotHaveClass('selected');

    await click('[data-test-preview-link-btn]');
    await waitForCardLoad();

    assert.ok(encodeColons(currentURL()).includes(`${CARDS_URL}/${cardId}/configure/preview`));
    assert.dom('[data-test-small-btn]').hasClass('selected');
    assert.dom('[data-test-medium-btn]').doesNotHaveClass('selected');
    assert.dom('[data-test-large-btn]').doesNotHaveClass('selected');
    await waitForAnimation(async () => await percySnapshot('preview - small card width'));

    await click('[data-test-large-btn]');
    assert.dom('[data-test-small-btn]').doesNotHaveClass('selected');
    assert.dom('[data-test-medium-btn]').doesNotHaveClass('selected');
    assert.dom('[data-test-large-btn]').hasClass('selected');
    await waitForAnimation(async () => await percySnapshot('preview - large card width'));

    await click('[data-test-mode-indicator-link="preview"]');
    await waitForCardLoad();

    assert.ok(encodeColons(currentURL()).includes(`${CARDS_URL}/${cardId}/configure/layout`));
    assert.dom('[data-test-small-btn]').doesNotHaveClass('selected');
    assert.dom('[data-test-medium-btn]').doesNotHaveClass('selected');
    assert.dom('[data-test-large-btn]').hasClass('selected');

    await click('[data-test-card-custom-style-button]');
    await waitForThemerLoad();

    assert.ok(encodeColons(currentURL()).includes(`${CARDS_URL}/${cardId}/configure/layout/themer`));
    assert.dom('[data-test-small-btn]').doesNotHaveClass('selected');
    assert.dom('[data-test-medium-btn]').doesNotHaveClass('selected');
    assert.dom('[data-test-large-btn]').hasClass('selected');

    await click('[data-test-mode-indicator-link="themer"]');
    await waitForCardLoad();

    assert.ok(encodeColons(currentURL()).includes(`${CARDS_URL}/${cardId}/configure/layout`));

    await click('[data-test-small-btn]');
    assert.dom('[data-test-small-btn]').hasClass('selected');
    assert.dom('[data-test-medium-btn]').doesNotHaveClass('selected');
    assert.dom('[data-test-large-btn]').doesNotHaveClass('selected');

    await click('[data-test-card-custom-style-button]');
    await waitForThemerLoad();

    assert.ok(encodeColons(currentURL()).includes(`${CARDS_URL}/${cardId}/configure/layout/themer`));
    assert.dom('[data-test-small-btn]').hasClass('selected');
    assert.dom('[data-test-medium-btn]').doesNotHaveClass('selected');
    assert.dom('[data-test-large-btn]').doesNotHaveClass('selected');

    await click('[data-test-preview-link-btn]');
    await waitForCardLoad();

    assert.ok(encodeColons(currentURL()).includes(`${CARDS_URL}/${cardId}/configure/preview`));
    assert.dom('[data-test-small-btn]').hasClass('selected');
    assert.dom('[data-test-medium-btn]').doesNotHaveClass('selected');
    assert.dom('[data-test-large-btn]').doesNotHaveClass('selected');
    await waitForAnimation(async () => await percySnapshot('preview - medium card width'));
  });

  test('can save CSS edits', async function(assert) {
    await visit(`${CARDS_URL}/${cardPath}`);
    await waitForCardLoad();

    assert.dom(`[data-test-themer-css]`).doesNotExist();
    assert.dom(`[data-test-css-format="isolated"][data-test-css-cards="[${testCard.canonicalURL}]"]`).exists();
    assert.ok(
      find(`[data-test-css-cards="[${testCard.canonicalURL}]"]`).innerText.includes('base css'),
      'base style is correct'
    );

    await visit(`${CARDS_URL}/${cardPath}/configure/layout`);
    await waitForCardLoad();

    assert.dom(`[data-test-themer-css]`).doesNotExist();
    assert.dom(`[data-test-css-format="isolated"][data-test-css-cards="[${testCard.canonicalURL}]"]`).exists();
    assert.ok(
      find(`[data-test-css-format="isolated"][data-test-css-cards="[${testCard.canonicalURL}]"]`).innerText.includes(
        'base css'
      ),
      'base style is correct'
    );

    await click('[data-test-card-custom-style-button]');
    await waitForThemerLoad();

    assert.dom(`[data-test-css-format="isolated"][data-test-css-cards="[${testCard.canonicalURL}"]`).doesNotExist();
    assert.dom(`[data-test-themer-css]`).exists();
    assert.ok(find(`[data-test-themer-css]`).innerText.includes('base css'), 'themer style is correct');

    await fillIn('[data-test-editor-pane] textarea', 'gorgeous styles');
    assert.ok(find(`[data-test-themer-css]`).innerText.includes('gorgeous styles'), 'themer style is correct');
    await saveCard();

    assert.dom(`[data-test-css-format="isolated"][data-test-css-cards="[${testCard.canonicalURL}]"]`).doesNotExist();
    assert.ok(find(`[data-test-themer-css]`).innerText.includes('gorgeous styles'), 'themer style is correct');

    await click('[data-test-mode-indicator-link="themer"]');
    await waitForCardLoad();

    assert.dom(`[data-test-themer-css]`).doesNotExist();
    assert.dom(`[data-test-css-format="isolated"][data-test-css-cards="[${testCard.canonicalURL}]"]`).exists();
    assert.ok(
      find(`[data-test-css-format="isolated"][data-test-css-cards="[${testCard.canonicalURL}]"]`).innerText.includes(
        'gorgeous styles'
      ),
      'base style is correct'
    );

    await visit(`${CARDS_URL}/${cardPath}`);
    await waitForCardLoad();

    assert.dom(`[data-test-themer-css]`).doesNotExist();
    assert.dom(`[data-test-css-format="isolated"][data-test-css-cards="[${testCard.canonicalURL}]"]`).exists();
    assert.ok(
      find(`[data-test-css-format="isolated"][data-test-css-cards="[${testCard.canonicalURL}]"]`).innerText.includes(
        'gorgeous styles'
      ),
      'base style is correct'
    );
  });

  test('dropdown displays default theme for new cards', async function(assert) {
    await visit(`${CARDS_URL}/${cardPath}/configure/layout`);
    await waitForCardLoad();

    await waitFor('[data-test-cs-component="dropdown"]');
    assert.dom('[data-test-cs-component="dropdown"]').exists();
    assert.dom('[data-test-cs-component="dropdown"]').containsText('Template theme');
    assert.dom('[data-test-cs-component="dropdown"]').doesNotContainText('Custom');
  });

  test('dropdown displays custom theme for cards with custom CSS', async function(assert) {
    await visit(`${CARDS_URL}/${cardPath}/configure/layout`);
    await waitForCardLoad();
    await click('[data-test-card-custom-style-button]');
    await waitForThemerLoad();

    await fillIn('[data-test-editor-pane] textarea', 'gorgeous styles');
    await saveCard();
    await click('[data-test-mode-indicator-link="themer"]');
    await waitForCardLoad();

    await waitFor('[data-test-cs-component="dropdown"]');
    assert.dom('[data-test-cs-component="dropdown"]').exists();
    assert.dom('[data-test-cs-component="dropdown"]').containsText('Custom');
    assert.dom('[data-test-cs-component="dropdown"]').doesNotContainText('Template theme');
  });

  test('selecting default theme resets css', async function(assert) {
    await visit(`${CARDS_URL}/${cardPath}/configure/layout`);
    await waitForCardLoad();
    await click('[data-test-card-custom-style-button]');
    await waitForThemerLoad();

    await fillIn('[data-test-editor-pane] textarea', 'gorgeous styles');
    await saveCard();
    await click('[data-test-mode-indicator-link="themer"]');
    await waitForCardLoad();

    await waitFor('[data-test-cs-component="dropdown"]');
    await selectChoose('[data-test-cs-component="dropdown"]', 'Template theme');
    await waitForCardPatch();
    await waitForCardLoad();

    assert.dom('[data-test-cs-component="dropdown"]').doesNotContainText('Custom');
    assert
      .dom(`[data-test-css-format="isolated"][data-test-css-cards="[${getCardIdFromURL()}]"]`)
      .containsText('base css');
  });

  test('buttons and dropdowns reflect custom style state', async function(assert) {
    await visit(`${CARDS_URL}/${cardPath}/configure/layout`);
    await waitForCardLoad();

    assert.dom('[data-test-card-custom-style-button]').includesText('New Custom Theme');
    assert.dom('[data-test-style-dropdown]').includesText('Template theme');
    assert.dom('[data-test-style-dropdown]').doesNotIncludeText('Custom');

    await click('[data-test-card-custom-style-button]');
    await waitForThemerLoad();

    await fillIn('[data-test-editor-pane] textarea', 'gorgeous styles');
    await saveCard();
    await click('[data-test-mode-indicator-link="themer"]');
    await waitForCardLoad();

    await waitFor('[data-test-cs-component="dropdown"]');
    assert.dom('[data-test-card-custom-style-button]').includesText('Edit Custom Theme');
    assert.dom('[data-test-style-dropdown]').includesText('Custom theme');
    assert.dom('[data-test-style-dropdown]').doesNotIncludeText('Template theme');
  });

  test('autosave works', async function(assert) {
    await visit(`${CARDS_URL}/${cardPath}/configure/layout`);
    await waitForCardLoad();

    await click('[data-test-card-custom-style-button]');
    await waitForThemerLoad();

    this.owner.lookup('service:autosave').autosaveDisabled = false;
    await fillIn('[data-test-editor-pane] textarea', 'gorgeous styles');
    await waitForCardPatch();
    await waitForCardAutosave();
    this.owner.lookup('service:autosave').autosaveDisabled = true;

    await visit(`${CARDS_URL}/${cardPath}/configure/layout`);
    await waitForCardLoad();
    assert.ok(
      find(`[data-test-css-format="isolated"][data-test-css-cards="[${testCard.canonicalURL}]"]`).innerText.includes(
        'gorgeous styles'
      ),
      'base style is correct'
    );
  });
});
