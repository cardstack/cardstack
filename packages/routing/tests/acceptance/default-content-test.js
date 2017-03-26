import { test } from 'qunit';
import moduleForAcceptance from '../../tests/helpers/module-for-acceptance';

moduleForAcceptance('Acceptance | default content');

test('renders own page content', function(assert) {
  visit('/burger');
  andThen(function() {
    assert.equal(currentURL(), '/burger');
    assert.equal(find('.meal-title').text(), 'Tasty Burger');
  });
});
