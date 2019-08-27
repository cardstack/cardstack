import { module, test } from 'qunit';
import { visit as dangerousVisit, settled, currentURL, click, fillIn } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import { setupMirage } from 'ember-cli-mirage/test-support';

// visit() throws a 'TransitionAborted' error when redirecting
// https://github.com/emberjs/ember-test-helpers/issues/332
async function visit(url) {
  try {
    await dangerousVisit(url);
  } catch (e) {
    if (e.message !== 'TransitionAborted') {
      throw e;
    }
  }

  await settled();
}

module('Acceptance | navigation', function (hooks) {
  setupApplicationTest(hooks);
  setupMirage(hooks);

  hooks.beforeEach(async function () {
    this.server.loadFixtures();
  });

  test('index route redirects to /catalog', async function (assert) {
    await visit(`/`);

    assert.equal(currentURL(), '/catalog');
  });

  test('can create and preview a new article', async function (assert) {
    await visit(`/catalog`);

    assert.equal(currentURL(), '/catalog');
    assert.dom('[data-test-boxel]').exists({ count: 2 });

    await click('.boxel-tray:nth-of-type(1) .catalog-item');

    assert.equal(currentURL(), '/catalog/article/preview');

    await click('[data-test-edit-button]');

    assert.equal(currentURL(), '/tools/article/sample/edit');

    await fillIn('.boxel-component:nth-of-type(1) [data-test-cs-component="text-field"] input', 'What is the meaning of this?');
    await fillIn('.boxel-component:nth-of-type(2) [data-test-cs-component="text-field"] input', 'Who are all you people and what are you doing in my house?');
    await fillIn('.boxel-component:nth-of-type(3) [data-test-cs-component="text-area"] textarea', 'Lorem ipsum dolor amet gluten-free iPhone humblebrag seitan XOXO deep v kickstarter disrupt banjo salvia lumbersexual trust fund microdosing actually.');
    await click('[data-test-tools-button-save]');

    assert.equal(currentURL(), '/articles/1');
    assert.dom('[data-test-boxel-title]').containsText('What is the meaning of this?');
    assert.dom('[data-test-boxel-description]').containsText('Who are all you people and what are you doing in my house?');
    assert.dom('[data-test-boxel-body]').containsText('Lorem ipsum dolor amet gluten-free iPhone humblebrag seitan');

    await click('[data-test-tools-button-preview]');

    assert.equal(currentURL(), '/tools/article/1/preview');
    assert.dom('[data-test-boxel]').exists({ count: 3 });
    assert.dom('.boxel-thumbnail').exists();
    assert.dom('.boxel-article-embedded').exists();
    assert.dom('.boxel-article-isolated').exists();
  });
});