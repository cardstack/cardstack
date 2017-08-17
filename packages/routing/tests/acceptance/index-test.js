import { test } from 'qunit';
import moduleForAcceptance from '../../tests/helpers/module-for-acceptance';

moduleForAcceptance('Acceptance | index');

test('renders own page content', function(assert) {
  visit('/c');
  andThen(function() {
    assert.equal(currentURL(), '/c');
    assert.equal(find('.blurb').text(), 'this is the homepage');
  });
});
