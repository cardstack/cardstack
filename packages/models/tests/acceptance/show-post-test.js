import { test } from 'qunit';
import moduleForAcceptance from '../../tests/helpers/module-for-acceptance';
import Fixtures from '@cardstack/test-support/fixtures';

moduleForAcceptance('Acceptance | show post');

let scenario = new Fixtures(factory => {
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
  await scenario.setup();
  await visit('/posts/1');
  assert.equal(currentURL(), '/posts/1');
  findWithAssert('h1:contains(hello world)');
});
