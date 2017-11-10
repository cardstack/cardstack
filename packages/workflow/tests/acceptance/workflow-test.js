import { test } from 'qunit';
import moduleForAcceptance from '../../tests/helpers/module-for-acceptance';

function assertUnhandledAlert(assert) {
  assert.equal(find("[data-test-alert-notification]").length, 1, "The unhandled alert notification appears");
}

function assertGroupCount(assert, groupName, value, assertionText) {
  assertTrimmedText(assert, `[data-test-group-counter="${groupName}"]`, value, assertionText);
}

function assertNoGroupCount(assert, groupName, assertionText) {
  assert.equal(find(`[data-test-group-counter="${groupName}"]`).length, 0, assertionText);
}

function assertCardCountInThreadList(assert, value, assertionText) {
  assert.equal(find('[data-test-thread-list-card]').length, value, assertionText);
}

moduleForAcceptance('Acceptance | Workflow');

test('Show group counters', function(assert) {
  visit('/');

  andThen(function() {
    assertUnhandledAlert(assert);
  });

  click('.cardstack-workflow-header');

  andThen(function() {
    assertGroupCount(assert, 'Today', 3);
    assertTrimmedText(assert, '[data-test-priority-header="Delegated"]', "Delegated");
    assertTrimmedText(assert, '[data-test-priority-header="Need Response"]', "Need Response");
    assertTrimmedText(assert, '[data-test-priority-header="For Your Information"]', "For Your Information");

    assertGroupCount(assert, "Delegated::Song Change Request", 1);
    assertGroupCount(assert, "Need Response::Song Change Request", 1);
    assertGroupCount(assert, "Need Response::Request to Publish Live", 1);
    assertGroupCount(assert, "Need Response::License Request", 2);
    assertGroupCount(assert, "For Your Information::License Request", 1);
  });
});

test('List threads that match the clicked tag', function(assert) {
  visit('/');
  click('.cardstack-workflow-header');
  click('[data-test-group-counter="Need Response::License Request"]');
  andThen(() => {
    assertCardCountInThreadList(assert, 3, "All threads having the clicked tag are shown");
    assert.equal(find(".cardstack-workflow-label-with-count-wrapper.active:contains(License Request)").length, 1, "The selected group is marked as active");
    assert.equal(find("[data-test-thread-list-card]:contains(This is going to be tough, my friend.)").length, 1)
    assert.equal(find("[data-test-thread-list-card]:contains(License request for Caspian's Sycamore, please?)").length, 1)
    assert.equal(find("[data-test-thread-list-card]:contains(License request for Chris Cornell's Seasons)").length, 1)

  });
});

test('List threads that match the Today date range', function(assert) {
  visit('/');
  click('.cardstack-workflow-header');
  click('[data-test-group-counter="Today"]');
  andThen(() => {
    assertCardCountInThreadList(assert, 3);
    assert.equal(find(".cardstack-workflow-label-with-count-wrapper.active:contains(Today)").length, 1, "The selected group is marked as active");
  });
});

test('Switch between thread lists and an individual thread view', function(assert) {
  visit('/');
  click('.cardstack-workflow-header');
  click('[data-test-group-counter="Delegated::Song Change Request"]');
  click('[data-test-thread-list-card]:first');
  andThen(() => {
    // There is the summary card on top and the "normal" card in the thread
    assert.equal(find('[data-test-message-card]:contains("Could we add yet more guitars to this Caspian song?")').length, 2);
  });

  click('[data-test-group-counter="Need Response::Request to Publish Live"]');
  andThen(() => {
    assertCardCountInThreadList(assert, 1);
  });

  click('[data-test-thread-list-card]:first');
  andThen(() => {
    assert.equal(find('[data-test-message-card]:contains("Could we change our previous cover of Pearl Jam\'s Daughter?")').length, 2);
  });

  click('[data-test-group-counter="Today"]');
  andThen(() => {
    assertCardCountInThreadList(assert, 3);
  });
});

test('Take action on a cue card', function(assert) {
  visit('/');
  click('.cardstack-workflow-header');
  click('[data-test-group-counter="Need Response::License Request"]');
  click('[data-test-thread-list-card]:contains("License request for Caspian\'s Sycamore, please?")');
  click('[data-test-approve-button]');

  andThen(() => {
    assertGroupCount(assert, "Need Response::License Request", 1, "Unhandled group count is decremented after approving a message");
    assertGroupCount(assert, 'Today', 2, "Unhandled group count is also decremented for date range group");
    assertUnhandledAlert(assert);
  });

  click('[data-test-group-counter="Need Response::Request to Publish Live"]');
  click('[data-test-thread-list-card]:last');
  click('[data-test-deny-button]');
  click('[data-test-read-button]'); // a chat message needs to be explicitly read - for now

  andThen(() => {
    assertNoGroupCount(assert, "Need Response::Request to Publish Live", "Unhandled group count becomes zero and disappears");
    assertUnhandledAlert(assert);
  });
});
