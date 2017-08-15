import { test } from 'qunit';
import moduleForAcceptance from '../../tests/helpers/module-for-acceptance';

moduleForAcceptance('Acceptance | content');

test('renders', function(assert) {
  visit('/beverages/new');
  andThen(function() {
    assert.equal(currentURL(), '/beverages/new');
    assert.equal(find('.bubbles').length, 1);
  });
});
