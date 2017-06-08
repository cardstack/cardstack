import { test } from 'qunit';
import moduleForAcceptance from '../../tests/helpers/module-for-acceptance';

moduleForAcceptance('Acceptance | show post');

test('visiting /show-post', function(assert) {
  visit('/posts/1');

  andThen(function() {
    assert.equal(currentURL(), '/posts/1');
    findWithAssert('h1:contains(hello world)');
  });
});
