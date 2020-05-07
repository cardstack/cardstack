import { module, test } from 'qunit';
import { visit, currentURL, click } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';

const movieId = 'star-wars-the-rise-of-skywalker';

module('Acceptance | collection', function (hooks) {
  setupApplicationTest(hooks);

  test('can select collection list', async function (assert) {
    await visit(`/movie-registry/${movieId}/edit`);
    assert.equal(currentURL(), `/movie-registry/${movieId}/edit`);
    assert.dom('[data-test-collection="list"]').exists();
    assert.dom('[data-test-collection-actions]').doesNotExist();
    assert.dom('[data-test-collection="list"]').hasClass('boxel-highlight');
    await click('[data-test-collection="list"]');
    assert.dom('[data-test-collection="list"]').hasClass('boxel-highlight--on');
    assert.dom('[data-test-collection-item="0"]').doesNotHaveClass('boxel-highlight--on');
    assert.dom('[data-test-collection-actions="list"]').exists();
    assert.dom('[data-test-collection-item-actions="0"]').doesNotExist();
  });

  test('can select collection item', async function (assert) {
    await visit(`/movie-registry/${movieId}/edit`);
    assert.equal(currentURL(), `/movie-registry/${movieId}/edit`);
    assert.dom('[data-test-collection-item="0"]').exists();
    assert.dom('[data-test-collection-item-actions="0"]').doesNotExist();
    assert.dom('[data-test-collection-item="0"]').hasClass('boxel-highlight');
    await click('[data-test-collection-item="0"]');
    assert.dom('[data-test-collection-item="0"]').hasClass('boxel-highlight--on');
    assert.dom('[data-test-collection="list"]').doesNotHaveClass('boxel-highlight--on');
    assert.dom('[data-test-collection-item-actions="0"]').exists();
    assert.dom('[data-test-collection-actions="list"]').doesNotExist();
  });

  test('can bulk-select and unselect items', async function (assert) {
    await visit(`/movie-registry/${movieId}/edit`);
    assert.dom('[data-test-collection-select-all]').doesNotExist();
    assert.dom('[data-test-collection-select-item="0"]').doesNotExist();
    await click('[data-test-collection="list"]');
    assert.dom('[data-test-collection-select-item="0"]').exists();
    assert.dom('[data-test-collection-select-item="1"]').exists();
    assert.dom('[data-test-collection-select-all]').exists();
    assert.dom('[data-test-collection-selected-count]').hasText('Select all');
    assert.dom('[data-test-collection-select-all] svg').doesNotHaveClass('collection-editor__select--partial');
    assert.dom('[data-test-collection-select-item="0"] svg').doesNotHaveClass('collection-editor__select--selected');
    await click('[data-test-collection-select-item="0"]');
    assert.dom('[data-test-collection-select-item="0"] svg').hasClass('collection-editor__select--selected');
    assert.dom('[data-test-collection-select-all] svg').hasClass('collection-editor__select--partial');
    await click('[data-test-collection-select-item="1"]');
    assert.dom('[data-test-collection-selected-count]').hasText('2 selected');
    await click('[data-test-collection-select-item="0"]');
    assert.dom('[data-test-collection-selected-count]').hasText('1 selected');
    await click('[data-test-collection-select-item="1"]');
    assert.dom('[data-test-collection-selected-count]').hasText('Select all');
    assert.dom('[data-test-collection-select-all] svg').doesNotHaveClass('collection-editor__select--partial');
    assert.dom('[data-test-collection-select-item="0"] svg').doesNotHaveClass('collection-editor__select--selected');
  });

  test('can toggle bulk-select and unselect all items', async function (assert) {
    await visit(`/movie-registry/${movieId}/edit`);
    await click('[data-test-collection="list"]');
    assert.dom('[data-test-collection-select-all]').exists();
    assert.dom('[data-test-collection-selected-count]').hasText('Select all');
    assert.dom('[data-test-collection-select-all] svg').doesNotHaveClass('collection-editor__select--selected');
    await click('[data-test-collection-select-all]');
    assert.dom('[data-test-collection-selected-count]').includesText('selected');
    assert.dom('[data-test-collection-select-all] svg').hasClass('collection-editor__select--selected');
    await click('[data-test-collection-select-all]');
    assert.dom('[data-test-collection-selected-count]').hasText('Select all');
    assert.dom('[data-test-collection-select-all] svg').doesNotHaveClass('collection-editor__select--selected');
  });

  test('clicking on select all after selecting an item unselects them all', async function (assert) {
    await visit(`/movie-registry/${movieId}/edit`);
    await click('[data-test-collection="list"]');
    assert.dom('[data-test-collection-select-all]').exists();
    await click('[data-test-collection-select-item="0"]');
    assert.dom('[data-test-collection-select-item="0"] svg').hasClass('collection-editor__select--selected');
    assert.dom('[data-test-collection-selected-count]').hasText('1 selected');
    assert.dom('[data-test-collection-select-all] svg').hasClass('collection-editor__select--partial');
    await click('[data-test-collection-select-all]');
    assert.dom('[data-test-collection-selected-count]').hasText('Select all');
    assert.dom('[data-test-collection-select-all] svg').doesNotHaveClass('collection-editor__select--selected');
    assert.dom('[data-test-collection-select-item="0"] svg').doesNotHaveClass('collection-editor__select--selected');
    await click('[data-test-collection-select-all]');
    assert.dom('[data-test-collection-selected-count]').includesText('selected');
    assert.dom('[data-test-collection-select-all] svg').hasClass('collection-editor__select--selected');
    assert.dom('[data-test-collection-select-item="0"] svg').hasClass('collection-editor__select--selected');
  });

  // TODO: more tests here
});
