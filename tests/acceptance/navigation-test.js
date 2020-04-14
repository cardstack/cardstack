import { module, test } from 'qunit';
import { visit, currentURL, click } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import { setupMirage } from 'ember-cli-mirage/test-support';

const movieId = 'star-wars-the-rise-of-skywalker';

module('Acceptance | navigation', function (hooks) {
  setupApplicationTest(hooks);
  setupMirage(hooks);

  hooks.beforeEach(async function () {
    this.server.loadFixtures();
  });

  test('index route works', async function (assert) {
    await visit(`/movie-registry`);
    assert.equal(currentURL(), `/movie-registry`);
    assert.dom('[data-test-movie-registry-nav]').exists();
    assert.dom('[data-test-movie-registry-main]').exists();
    assert.dom(`[data-test-movie-registry-movie=${movieId}]`).exists();
  });

  test('view route works', async function (assert) {
    await visit(`/movie-registry/${movieId}`);
    assert.equal(currentURL(), `/movie-registry/${movieId}`);
    assert.dom('[data-test-movie="view-mode"]').exists();
    assert.dom('[data-test-view-field]').exists();
    assert.dom('[data-test-view-field="collection-list"]').exists();
    assert.dom('[data-test-view-field="collection-grid"]').exists();
  });

  test('edit route works', async function (assert) {
    await visit(`/movie-registry/${movieId}/edit`);
    assert.equal(currentURL(), `/movie-registry/${movieId}/edit`);
    assert.dom('[data-test-movie="edit-mode"]').exists();
    assert.dom('[data-test-edit-field="collection-editors"]').exists();
    assert.dom('[data-test-edit-field="form-editors"]').exists();
  });

  test('can navigate to view route from index', async function (assert) {
    await visit(`/movie-registry`);
    await click(`[data-test-movie-registry-movie=${movieId}]`);
    assert.equal(currentURL(), `/movie-registry/${movieId}`);
  });

  test('can navigate between view and edit routes', async function (assert) {
    await visit(`/movie-registry/${movieId}`);
    await click(`[data-test-movie-edit-btn]`);
    assert.equal(currentURL(), `/movie-registry/${movieId}/edit`);
    assert.dom('[data-test-movie-mode="edit-mode"]').exists();
    await click(`[data-test-movie-view-btn]`);
    assert.equal(currentURL(), `/movie-registry/${movieId}`);
    assert.dom('[data-test-movie-mode="view-mode"]').exists();
  });
});
