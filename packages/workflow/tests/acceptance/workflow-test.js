import { test } from 'qunit';
import moduleForAcceptance from '../../tests/helpers/module-for-acceptance';

moduleForAcceptance('Acceptance | Workflow');

test('Show group counters', function(assert) {
  visit('/');

  andThen(function() {
    assertTrimmedText(assert, '[data-test-total-notification-count]', "5");
  });

  click('.cardstack-workflow-header');

  andThen(function() {
    assertTrimmedText(assert, '[data-test-date-range-counter="Today"]', "2");
    assertTrimmedText(assert, '[data-test-priority-header="Need Response"]', "Need Response");
    assertTrimmedText(assert, '[data-test-priority-header="Automatically Processed"]', "Automatically Processed");
    assertTrimmedText(assert, '[data-test-priority-header="For Your Information"]', "For Your Information");

    assertTrimmedText(assert, '[data-test-tag-counter="Request to publish live"]', "2");
    assertTrimmedText(assert, '[data-test-tag-counter="Ready for copyediting"]', "1");
    assertTrimmedText(assert, '[data-test-tag-counter="Course information synced"]', "1");
    assertTrimmedText(assert, '[data-test-tag-counter="New local content added"]', "1");
  });
});

test('List message cards that match the clicked tag', function(assert) {
  visit('/');
  click('.cardstack-workflow-header');
  click('[data-test-tag-counter="Request to publish live"]');
  andThen(() => {
    assert.equal(find('[data-test-message-list-card]').length, 2);
    assert.equal(find(".message-list-card:contains(Matt, could you push live my cover of Pearl Jam's Daughter?)").length, 1)
    assert.equal(find(".message-list-card:contains(Needs to have the Home song approved by tomorrow.)").length, 1)
  });
});

test('List message cards that match the Today date range', function(assert) {
  visit('/');
  click('.cardstack-workflow-header');
  click('[data-test-date-range-counter="Today"]');
  andThen(() => {
    assert.equal(find('[data-test-message-list-card]').length, 2);
  });
});

test('Switch between message lists and individual message card', function(assert) {
  visit('/');
  click('.cardstack-workflow-header');
  click('[data-test-tag-counter="Ready for copyediting"]');
  click('[data-test-message-list-card]:first');
  andThen(() => {
    assert.equal(find('[data-test-message-card]:contains("Tool\'s Forty Six & 2. Please approve.")').length, 1);
  });

  click('[data-test-tag-counter="Request to publish live"]');
  andThen(() => {
    assert.equal(find('[data-test-message-list-card]').length, 2);
  });

  click('[data-test-message-list-card]:first');
  andThen(() => {
    assert.equal(find('[data-test-message-card]:contains("Matt, could you push live my cover of Pearl Jam\'s Daughter?")').length, 1);
  });

  click('[data-test-date-range-counter="Today"]');
  andThen(() => {
    assert.equal(find('[data-test-message-list-card]').length, 2);
  });
});

test('Take action on a cue card', function(assert) {
  assert.expect(0);
  //TODO: Click approve and verify that the counter for this tag has been decremented by one
  // click('[data-test-approve-button]');
  // andThen(() => {
  //   assertTrimmedText(assert, '[data-test-tag-counter="Ready for copyediting"]', "0");
  //   assert.equal(find('[data-test-empty-message-card-list]').length, 1);
  // });
  //TODO: Click another card with a label that has >1 cards to take action on
  // When clicked, counter should be decreased by one, and the undhanled cards should be displayed
  // in a list
});
