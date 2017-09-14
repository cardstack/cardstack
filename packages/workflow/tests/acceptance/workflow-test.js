import { test } from 'qunit';
import moduleForAcceptance from '../../tests/helpers/module-for-acceptance';

function assertUnhandledCount(assert, value, assertionText) {
  assertTrimmedText(assert, '[data-test-total-notification-count]', value, assertionText);
}

function assertGroupCount(assert, groupName, value, assertionText) {
  assertTrimmedText(assert, `[data-test-group-counter="${groupName}"]`, value, assertionText);
}

function assertCardCountInMessageList(assert, value, assertionText) {
  assert.equal(find('[data-test-message-list-card]').length, value, assertionText);
}

moduleForAcceptance('Acceptance | Workflow');

test('Show group counters', function(assert) {
  visit('/');

  andThen(function() {
    assertUnhandledCount(assert, 3);
  });

  click('.cardstack-workflow-header');

  andThen(function() {
    assertGroupCount(assert, 'Today', 2);
    assertTrimmedText(assert, '[data-test-priority-header="Need Response"]', "Need Response");
    assertTrimmedText(assert, '[data-test-priority-header="Processed"]', "Processed");
    assertTrimmedText(assert, '[data-test-priority-header="For Your Information"]', "For Your Information");

    assertGroupCount(assert, "Need Response::Request to publish live", 2);
    assertGroupCount(assert, "Need Response::Ready for copyediting", 1);
    assertGroupCount(assert, "Processed::Course information synced", 0);
    assertGroupCount(assert, "For Your Information::New local content added", 0);
  });
});

test('List message cards that match the clicked tag', function(assert) {
  visit('/');
  click('.cardstack-workflow-header');
  click('[data-test-group-counter="Need Response::Request to publish live"]');
  andThen(() => {
    assertCardCountInMessageList(assert, 2);
    assert.equal(find(".cardstack-workflow-label-with-count-wrapper.active:contains(Request to publish live)").length, 1, "The selected group is marked as active");
    assert.equal(find("[data-test-message-list-card]:contains(Matt, could you push live my cover of Pearl Jam's Daughter?)").length, 1)
    assert.equal(find("[data-test-message-list-card]:contains(Needs to have the Home song approved by tomorrow.)").length, 1)
  });
});

test('List message cards that match the Today date range', function(assert) {
  visit('/');
  click('.cardstack-workflow-header');
  click('[data-test-group-counter="Today"]');
  andThen(() => {
    assertCardCountInMessageList(assert, 2);
    assert.equal(find(".cardstack-workflow-label-with-count-wrapper.active:contains(Today)").length, 1, "The selected group is marked as active");
  });
});

test('Switch between message lists and individual message card', function(assert) {
  visit('/');
  click('.cardstack-workflow-header');
  click('[data-test-group-counter="Need Response::Ready for copyediting"]');
  click('[data-test-message-list-card]:first');
  andThen(() => {
    assert.equal(find('[data-test-message-card]:contains("Updated lyrics for Hey, Joe.")').length, 1);
  });

  click('[data-test-group-counter="Need Response::Request to publish live"]');
  andThen(() => {
    assertCardCountInMessageList(assert, 2);
  });

  click('[data-test-message-list-card]:first');
  andThen(() => {
    assert.equal(find('[data-test-message-card]:contains("Matt, could you push live my cover of Pearl Jam\'s Daughter?")').length, 1);
  });

  click('[data-test-group-counter="Today"]');
  andThen(() => {
    assertCardCountInMessageList(assert, 2);
  });
});

test('No cards for the selected tag', function(assert) {
  visit('/');
  click('.cardstack-workflow-header');
  click('[data-test-group-counter="Processed::Course information synced"]');

  andThen(() => {
    assertCardCountInMessageList(assert, 0);
    assertTrimmedText(assert, '[data-test-empty-group-message]', 'There are no cards in this group.')
  });
});

test('Take action on a cue card', function(assert) {
  visit('/');
  click('.cardstack-workflow-header');
  click('[data-test-group-counter="Need Response::Request to publish live"]');
  click('[data-test-message-list-card]:first');
  click('[data-test-approve-button]');

  andThen(() => {
    assertGroupCount(assert, "Need Response::Request to publish live", "1", "Unhandled group count is decremented after approving a message");
    assertGroupCount(assert, 'Today', "1", "Unhandled group count is also decremented for date range group");
    //FIXME: This (assertCardCountInMessageList) should work but it doesn't, see workflow-service#messagesWithSelectedTag
    // assertCardCountInMessageList(assert, 1, "The handled card is taken out of the list");
    //TODO: The Processed priority should display the number of *handled* messages
    // assertGroupCount(assert, "Processed::Request to publish live", 1);
    assertUnhandledCount(assert, 2, "The total count is decremented");
  });

  click('[data-test-group-counter="Need Response::Request to publish live"]');
  click('[data-test-message-list-card]:last');
  click('[data-test-deny-button]');

  andThen(() => {
    assertGroupCount(assert, "Need Response::Request to publish live", "0", "Unhandled group count is decremented after denying a message");
    assertUnhandledCount(assert, 1, "The total count is decremented");
  });
});
