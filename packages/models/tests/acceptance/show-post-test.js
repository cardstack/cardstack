import { module, test } from 'qunit';
import { setupApplicationTest } from 'ember-qunit';
import { visit, currentURL } from '@ember/test-helpers';
import Fixtures from '@cardstack/test-support/fixtures';

module('Acceptance | show post', function(hooks) {
  setupApplicationTest(hooks);

  hooks.beforeEach(async function() {
    await scenario.setup();
    await this.owner.lookup('service:cardstack-codegen').refreshCode();
  });

  let scenario = new Fixtures('default', factory => {
    factory.addResource('content-types', 'posts')
      .withRelated('fields', [
        factory.addResource('fields', 'title').withAttributes({
          fieldType: '@cardstack/core-types::string'
        })
      ]);
    factory.addResource('posts', '1')
      .withAttributes({
        title: 'hello world'
      });
  });

  test('visiting /show-post', async function(assert) {
    await visit('/posts/1');
    assert.equal(currentURL(), '/posts/1');
    assert.equal(this.element.querySelector('h1').textContent.trim(), 'hello world');
  });
});
