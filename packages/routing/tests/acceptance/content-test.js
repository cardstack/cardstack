import { module, test } from 'qunit';
import { setupApplicationTest } from 'ember-qunit';
import { visit, currentURL, click } from '@ember/test-helpers';

module('Acceptance | content', function(hooks) {
  setupApplicationTest(hooks);

  test('renders own page content', async function(assert) {
    await visit('/posts/1');
    assert.equal(currentURL(), '/posts/1');
    assert.equal(this.element.querySelector('.title').textContent.trim(), 'hello world');
  });

  test('passes query params to primary card in route', async function(assert){
    await visit('/posts/1?posts[foo]=bar&posts[bee]=bop');
    assert.equal(currentURL(), '/posts/1?posts[foo]=bar&posts[bee]=bop');
    assert.equal(this.element.querySelector('.foo').textContent.trim(), 'foo is bar');
    assert.equal(this.element.querySelector('.bee').textContent.trim(), 'bee is bop');
  });

  test('renders error card content is missing', async function(assert) {
    await visit('/posts/bogus');
    assert.equal(currentURL(), '/posts/bogus');
    assert.equal(this.element.querySelector('h1').textContent.trim(), 'Not Found');
  });

  test('reloads models on route transitions', async function(assert) {
    await visit('/categories/category-1');
    await click('[data-test-post="1"]')

    assert.equal(currentURL(), '/posts/1');
  });
});
