import { test } from 'qunit';
import moduleForAcceptance from '../../tests/helpers/module-for-acceptance';

moduleForAcceptance('Acceptance | new-content');

test('renders', function(assert) {
  visit('/c/posts/new');
  andThen(function() {
    assert.equal(currentURL(), '/c/posts/new');
    assert.equal(find('.title').length, 1);
  });
});

test('renders default content type', function(assert) {
  visit('/c/pages/new');
  andThen(function() {
    assert.equal(currentURL(), '/c/pages/new');
    assert.equal(find('.blurb').length, 1);
  });
});
