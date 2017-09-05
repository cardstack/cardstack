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
    assertTrimmedText(assert, '[data-test-priority-header="Need Response"]', "Need Response");
    assertTrimmedText(assert, '[data-test-priority-header="Automatically Processed"]', "Automatically Processed");

    assertTrimmedText(assert, '[data-test-tag-counter="Request to publish live"]', "2");
    assertTrimmedText(assert, '[data-test-tag-counter="Ready for copyediting"]', "1");
    assertTrimmedText(assert, '[data-test-tag-counter="Course information synced"]', "0");
  });
});

test('List of message cards that match clicked tag', function(assert) {
  visit('/');
  click('.cardstack-workflow-header');
  click('[data-test-tag-counter="Request to publish live"]');
  andThen(() => {
    assert.equal(find('[data-test-message-card-tag="Request to publish live"]').length, 2);
    assert.equal(find(".message-card:contains(Matt, could you push live my cover of Pearl Jam's Daughter?)").length, 1)
    assert.equal(find(".message-card:contains(Needs to have the Home song approved by tomorrow.)").length, 1)
  });
});
