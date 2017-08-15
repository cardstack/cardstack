import { test } from 'qunit';
import moduleForAcceptance from '../../tests/helpers/module-for-acceptance';

moduleForAcceptance('Acceptance | card');

test('visiting /card', function(assert) {
  visit('/card');

  andThen(function() {
    assert.equal(currentURL(), '/card');
    assert.equal(find('.card-flavor').text(), 'tea');
    assert.equal(find('.card-size').text(), '8 oz');
  });
});
