import { module, test, skip } from 'qunit';
import { visit, click, waitFor, fillIn, triggerEvent, waitUntil, find} from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import { ciSessionId } from '@cardstack/test-support/environment';
import { hubURL } from '@cardstack/plugin-utils/environment';
import { differenceBy } from 'lodash';

async function openBottomEdge() {
  await click('[data-test-open-bottom-edge]');
  await waitFor('[data-card-picker-toolbox-header]');
  await waitUntil(() => !find('.cardstack-card-picker--loading'));
}

async function getDocuments(type) {
  let url = `${hubURL}/api/${type}?page[size]=1000`;
  let response = await fetch(url, {
    headers: {
      authorization: `Bearer ${ciSessionId}`,
      "content-type": 'application/vnd.api+json'
    }
  });
  return (await response.json()).data;
}

module('Acceptance | close button', function(hooks) {
  setupApplicationTest(hooks);

  test('Open button opens bottom edge', async function(assert) {
    await visit('/');
    await openBottomEdge();

    assert.dom('[data-card-picker-toolbox-header]').exists();
    assert.dom('[data-test-card-picker-close-button]').exists();
  });

  // the waitUntil seems to be randomly timing out. skipping until we can make this test more reliable
  skip('Close button closes bottom edge', async function(assert) {
    await visit('/');
    await openBottomEdge();

    await click('[data-test-card-picker-close-button]');
    await waitUntil(() => !find('[data-card-picker-toolbox-header]')); // this waitUntil is randomly timing out

    assert.dom('[data-card-picker-toolbox-header]').doesNotExist();
    assert.dom('[data-test-card-picker-close-button]').doesNotExist();
  });

  test('Card picker initially shows all documents for the requested content type with the specified sort', async function(assert) {
    await visit('/');
    await openBottomEdge();

    assert.equal(document.querySelectorAll('img.cs-card-picker-image-item--image').length, 12);
    assert.equal(true, [...document.querySelectorAll('img.cs-card-picker-image-item--image')].every(node => Boolean(node.getAttribute('src'))), 'all images have an "src" attribute');
  });

  test('A card can be selected from the card picker', async function(assert) {
    await visit('/');
    await openBottomEdge();

    let imgSrc = document.querySelector('[data-card-picker-card="0"] img').getAttribute('src');
    let filename = document.querySelector('[data-card-picker-card="0"] .cs-card-picker-image-item--filename').textContent;
    await click('[data-card-picker-card="0"]');
    await waitUntil(() => !find('[data-card-picker-toolbox-header]'));

    assert.equal(document.querySelector('.selected-image img').getAttribute('src'), imgSrc);
    assert.equal(document.querySelector('.selected-image .cs-card-picker-image-item--filename').textContent, filename);
  });

  test('Card picker can filter displayed search results', async function(assert) {
    await visit('/');
    await openBottomEdge();

    await fillIn('.cs-query-editor-input', 'dog');
    await waitUntil(() => !find('.cardstack-card-picker--loading'));

    assert.equal(document.querySelectorAll('img.cs-card-picker-image-item--image').length, 12);
    assert.equal(true, [...document.querySelectorAll('img.cs-card-picker-image-item--image')].every(node => Boolean(node.getAttribute('src'))), 'all images have an "src" attribute');
  });

  test('The filter "clear" button clears the filter string and shows all documents for requested content type', async function(assert) {
    await visit('/');
    await openBottomEdge();

    await fillIn('.cs-query-editor-input', 'dog');
    await waitUntil(() => !find('.cardstack-card-picker--loading'));

    await click('.cs-query-editor-clear');
    await waitUntil(() => !find('.cardstack-card-picker--loading'));

    assert.equal(document.querySelectorAll('img.cs-card-picker-image-item--image').length, 12);
    assert.equal(true, [...document.querySelectorAll('img.cs-card-picker-image-item--image')].every(node => Boolean(node.getAttribute('src'))), 'all images have an "src" attribute');
  });

  test('Card picker can display more than one page of results', async function(assert) {
    await visit('/');
    await openBottomEdge();

    assert.dom('.cardstack-card-picker--load-more-button').exists();

    await click('.cardstack-card-picker--load-more-button');
    await waitUntil(() => !find('.cardstack-card-picker--loading'));

    assert.equal(document.querySelectorAll('img.cs-card-picker-image-item--image').length, 13);
    assert.equal(true, [...document.querySelectorAll('img.cs-card-picker-image-item--image')].every(node => Boolean(node.getAttribute('src'))), 'all images have an "src" attribute');
  });

  test('When the requested content type is cardstack-image, a new image file can be uploaded', async function(assert) {
    let originalImages = await getDocuments('cardstack-images');

    await visit('/');
    await openBottomEdge();

    let imgSrc = document.querySelector('[data-card-picker-card="5"] img').getAttribute('src');
    await click('.cardstack-card-picker--upload-file-button');

    let response = await fetch(imgSrc);
    let blob = await response.blob();

    await triggerEvent('.cardstack-image-upload-modal input[type=file]', 'change', [blob] );
    await waitUntil(() => !find('.cardstack-image-upload-modal'));
    await waitUntil(() => !find('.cardstack-card-picker--loading'));

    let updatedImages = await getDocuments('cardstack-images');

    assert.equal(updatedImages.length, originalImages.length + 1);
    let [ newImage ] = differenceBy(updatedImages, originalImages, 'id');

    assert.equal(newImage.attributes['image-file-name'], document.querySelector('[data-card-picker-card="0"] .cs-card-picker-image-item--filename').textContent.trim());
  });
});
