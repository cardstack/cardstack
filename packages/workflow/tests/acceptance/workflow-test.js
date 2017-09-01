import { test } from 'qunit';
import moduleForAcceptance from '../../tests/helpers/module-for-acceptance';

moduleForAcceptance('Acceptance | Workflow');

test('The first-level workflow sidebar', function(assert) {
  visit('/');

  andThen(function() {
    assertTrimmedText(assert, '[data-test-total-notification-count]', "3");
  });

  click('.cardstack-workflow-header');

  andThen(function() {
    assertTrimmedText(assert, '[data-test-tag-counter="Request to publish live"]', "2");
    assertTrimmedText(assert, '[data-test-tag-counter="Ready for copyediting"]', "1");
    assertTrimmedText(assert, '[data-test-tag-counter="Course information synced"]', "0");
  });
});
