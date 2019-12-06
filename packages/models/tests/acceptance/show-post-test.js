import { module, test } from 'qunit';
import { setupApplicationTest } from 'ember-qunit';
import { visit, currentURL } from '@ember/test-helpers';
import Fixtures from '@cardstack/test-support/fixtures';

module('Acceptance | show post', function(hooks) {
  setupApplicationTest(hooks);

  let scenario = new Fixtures({
    create(factory) {
      factory.addResource('content-types', 'posts').withRelated('fields', [
        factory.addResource('fields', 'title').withAttributes({
          fieldType: '@cardstack/core-types::string',
        }),
      ]);
      factory.addResource('posts', '1').withAttributes({
        title: 'hello world',
      });
      factory
        .addResource('grants', 'wide-open')
        .withAttributes({
          mayWriteFields: true,
          mayReadFields: true,
          mayCreateResource: true,
          mayReadResource: true,
          mayUpdateResource: true,
          mayDeleteResource: true,
        })
        .withRelated('who', [{ type: 'groups', id: 'everyone' }]);
    },

    destroy() {
      return [{ type: 'posts' }];
    },
  });

  scenario.setupTest(hooks);

  hooks.beforeEach(async function() {
    await this.owner.lookup('service:cardstack-codegen').refreshCode();
  });

  test('visiting /show-post', async function(assert) {
    await visit('/posts/1');
    assert.equal(currentURL(), '/posts/1');
    assert.dom(this.element.querySelector('h1')).hasText('hello world');
  });
});
