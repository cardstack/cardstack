import { test } from 'qunit';
import moduleForAcceptance from '../../tests/helpers/module-for-acceptance';

moduleForAcceptance('Acceptance | new-content');

test('renders', function(assert) {
  visit('/posts/new');
  andThen(function() {
    assert.equal(currentURL(), '/posts/new');
    assert.equal(find('.title').length, 1);
  });
});

test('renders default content type', function(assert) {
  visit('/pages/new');
  andThen(function() {
    assert.equal(currentURL(), '/pages/new');
    assert.equal(find('.blurb').length, 1);
  });
});
