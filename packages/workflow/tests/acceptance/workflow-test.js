import Ember from 'ember';
import { test } from 'qunit';
import moduleForAcceptance from '../../tests/helpers/module-for-acceptance';

function waitFor(time) {
  return new Ember.RSVP.Promise((resolve) => {
    setTimeout(resolve, time);
  });
}

moduleForAcceptance('Acceptance | workflow');

test('The workflow sidebar', function(assert) {
  visit('/');

  andThen(function() {
    assert.equal(find('.cardstack-workflow-notification-count').text().trim(), 3);
  });

  click('.cardstack-workflow-launcher')
    // This is a hack to work around a probable timing issue in ember-toolbars
    .then(() => waitFor(2000))
    .then(function() {
      assert.equal(find('[data-test-category-counter="Request to publish live"]').text().trim(), 2);
      assert.equal(find('[data-test-category-counter="Ready for copyediting"]').text().trim(), 1);
      assert.equal(find('[data-test-category-counter="Course information synced"]').text().trim(), 0);
    });

});
