import { module, test } from 'qunit';
import { setupApplicationTest } from 'ember-qunit';
import { visit, click } from '@ember/test-helpers';

// use the main:router location API to get the current URL since we are
// maniupating the URL using the location API
function currentURL(owner) {
  let router = owner.lookup('router:main');
  return router.get('location').getURL();
}

module('Acceptance | content', function(hooks) {
  setupApplicationTest(hooks);

  test('renders own page content', async function(assert) {
    await visit('/posts/1');
    assert.equal(currentURL(this.owner), '/posts/1');
    assert.dom('.title').hasText('hello world');
  });

  test('passes query params to primary card in route', async function(assert) {
    await visit('/posts/1?posts[foo]=bar&posts[bee]=bop');
    assert.equal(currentURL(this.owner), '/posts/1?posts[foo]=bar&posts[bee]=bop');
    assert.dom('.foo').hasText('foo is bar');
    assert.dom('.bee').hasText('bee is bop');
  });

  test('renders error card content is missing', async function(assert) {
    await visit('/posts/bogus');
    assert.equal(currentURL(this.owner), '/posts/bogus');
    assert.dom('h1').hasText('Not Found');
  });

  test('reloads models on route transitions', async function(assert) {
    await visit('/categories/category-1');
    await click('[data-test-post="1"]');

    assert.equal(currentURL(this.owner), '/posts/1');
  });

  test('card can set query param', async function(assert) {
    await visit('/posts/1');
    await click('.set-query-param-1');

    assert.equal(currentURL(this.owner), '/posts/1?posts[foo]=fee');
  });

  test('card can change query param', async function(assert) {
    await visit('/posts/1?posts[foo]=bar');
    await click('.set-query-param-2');

    assert.equal(currentURL(this.owner), '/posts/1?posts[foo]=fee%20fo%20fum');
  });

  test('card can clear query param', async function(assert) {
    await visit('/posts/1?posts[foo]=bar');
    await click('.clear-query-param');

    assert.equal(currentURL(this.owner), '/posts/1');
  });

  test('card can not set undeclared query param', async function(assert) {
    await visit('/posts/1');
    await click('.set-undeclared-query-param');

    assert.equal(currentURL(this.owner), '/posts/1');
  });

  test('card can not clear undeclared query param', async function(assert) {
    await visit('/posts/1?posts[blah]=bar');
    await click('.clear-undeclared-query-param');

    assert.equal(currentURL(this.owner), '/posts/1?posts[blah]=bar');
  });

  test('card can set page title', async function(assert) {
    await visit('/posts/1');
    let headData = this.owner.lookup('service:head-data');

    assert.equal(headData.title, 'hello world');
  });

  test('page title updates when the route changes', async function(assert) {
    await visit('/posts/1');
    assert.equal(currentURL(this.owner), '/posts/1');

    await visit('/posts/2');
    assert.equal(currentURL(this.owner), '/posts/2');
    let headData = this.owner.lookup('service:head-data');

    assert.equal(headData.title, 'second post');
  });
});
