import { test } from 'qunit';
import moduleForAcceptance from '../../tests/helpers/module-for-acceptance';

moduleForAcceptance('Acceptance | default content');

test('renders own page content', function(assert) {
  visit('/');
  andThen(function() {
    assert.equal(currentURL(), '/');
    assert.equal(find('.meal-title').text(), 'The Special');
  });
});
