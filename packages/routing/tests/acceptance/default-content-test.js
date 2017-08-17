import { test } from 'qunit';
import moduleForAcceptance from '../../tests/helpers/module-for-acceptance';

moduleForAcceptance('Acceptance | default content');

test('renders own page content', function(assert) {
  visit('/c/second');
  andThen(function() {
    assert.equal(currentURL(), '/c/second');
    assert.equal(find('.blurb').text(), 'I am the second page');
  });
});
