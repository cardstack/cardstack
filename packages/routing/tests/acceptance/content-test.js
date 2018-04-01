import { module, test } from 'qunit';
import { setupApplicationTest } from 'ember-qunit';
import { visit, currentURL } from '@ember/test-helpers';

module('Acceptance | content', function(hooks) {
  setupApplicationTest(hooks);

  test('renders own page content', async function(assert) {
    await visit('/c/posts/1');
    assert.equal(currentURL(), '/c/posts/1');
    assert.equal(this.element.querySelector('.title').textContent.trim(), 'hello world');
  });

  test('redirects for default content type', async function(assert) {
    await visit('/c/pages/second');
    assert.equal(currentURL(), '/c/second');
    assert.equal(this.element.querySelector('.blurb').textContent.trim(), 'I am the second page');
  });

  test('redirects for singular content type', async function(assert) {
    await visit('/c/post/1');
    assert.equal(currentURL(), '/c/posts/1');
  });

  test('redirects for singular default content type', async function(assert) {
    await visit('/c/page/second');
    assert.equal(currentURL(), '/c/second');
  });


  test('renders placeholder type when content is missing', async function(assert) {
    await visit('/c/posts/bogus');
    assert.equal(currentURL(), '/c/posts/bogus');
    assert.equal(this.element.querySelector('h1').textContent.trim(), 'Not Found');
  });
});
