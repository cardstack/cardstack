import { test } from 'qunit';
import moduleForAcceptance from '../../tests/helpers/module-for-acceptance';

moduleForAcceptance('Acceptance | cardstack-url');

test('renders correct links', function(assert) {
  visit('/links');
  andThen(function() {
    assert.equal(find('.page-test').text(), '/c/the-permalink');
    assert.equal(find('.post-test').text(), '/c/posts/123%2045');
  });
});
