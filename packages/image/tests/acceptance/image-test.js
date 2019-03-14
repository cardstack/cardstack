import { module, test } from 'qunit';
import { setupApplicationTest } from 'ember-qunit';
import { visit, currentURL, click, find, waitFor, waitUntil } from '@ember/test-helpers';

async function login() {
  await click('[data-test-cardstack=login-button]');
  return waitFor('.cardstack-tools-launcher');
}

async function openCoverImageField() {
  let element =  [...document.querySelectorAll('.cs-toolbox-section label')].find(element => /Cover Image/.test(element.textContent));
  await click(element);
  return element.closest('section');
}

module('Acceptance | image field editor', function(hooks) {
  setupApplicationTest(hooks);

  hooks.beforeEach(function() {
    delete localStorage['cardstack-tools'];
  });

  hooks.afterEach(function() {
    delete localStorage['cardstack-tools'];
  });

  test('attaching an image', async function(assert) {
    await visit('/hub/articles/new');
    assert.equal(currentURL(), '/hub/articles/new');
    await login();
    await click('.cardstack-tools-launcher');
    await waitFor('.cs-active-composition-panel--main');
    await click('[data-test-cs-editor-switch]');

    await openCoverImageField();
    await click('.cardstack-image-editor-button--choose');
    await waitFor('[data-card-picker-toolbox-header]');
    await waitUntil(() => !find('.cardstack-card-picker--loading'));

    let imgSrc = document.querySelector('[data-card-picker-card="0"] img').getAttribute('src');
    await click('[data-card-picker-card="0"]');
    await waitUntil(() => !find('[data-card-picker-toolbox-header]'));

    assert.dom(`img.cs-image[src="${imgSrc}"]`).exists();

    // wait until no animation is happening before ending the test to prevent
    // ember errors
    await waitUntil(() => !find('.liquid-animating') )
  });

  test('removing an image', async function (assert) {
    await visit('/hub/articles/new');
    await login();
    await click('.cardstack-tools-launcher');
    await waitFor('.cs-active-composition-panel--main');
    await click('[data-test-cs-editor-switch]');

    await openCoverImageField();
    await click('.cardstack-image-editor-button--choose');
    await waitFor('[data-card-picker-toolbox-header]');
    await waitUntil(() => !find('.cardstack-card-picker--loading'));

    await click('[data-card-picker-card="0"]');
    await waitUntil(() => !find('[data-card-picker-toolbox-header]'));

    await click('.cardstack-image-editor-button--remove');
    assert.dom('img.cs-image').doesNotExist();

    // wait until no animation is happening before ending the test to prevent
    // ember errors
    await waitUntil(() => !find('.liquid-animating'))
  });
});
