import { module, skip } from 'qunit';
import { setupApplicationTest } from 'ember-qunit';
import { visit, click } from '@ember/test-helpers';

module('Acceptance | Workflow', function(hooks) {
  setupApplicationTest(hooks);

  function find() {
    throw new Error('these tests need to be refactored away from "find", but they are skipped right now so I\'m leaving them alone');
  }

  hooks.beforeEach(function(assert) {
    assert.trimmedText = (selector, text, errorMessage) => {
      let element = this.element.querySelector(selector);
      if (!element) {
        assert.fail(`Did not find ${selector}`);
        return;
      }
      let elementText = element.text().trim();
      assert.equal(elementText, text, errorMessage);
    };

    assert.unhandledAlert = ()  => {
      this.equal(this.element.querySelectorAll("[data-test-alert-notification]").length, 1, "The unhandled alert notification appears");
    };
    assert.groupCount = (groupName, value, assertionText) => {
      assert.trimmedText(assert, this.element.querySelector(`[data-test-group-counter="${groupName}"]`), value, assertionText);
    };

    assert.noGroupCount = (assert, groupName, assertionText) => {
      assert.equal(this.element.querySelectorAll(`[data-test-group-counter="${groupName}"]`).length, 0, assertionText);
    };

    assert.cardCountInThreadList = (assert, value, assertionText) => {
      assert.equal(this.element.querySelectorAll('[data-test-thread-list-card]').length, value, assertionText);
    };
  })

  skip('Show group counters', async function(assert) {
    await visit('/');

    assert.unhandledAlert();

    await click('.cardstack-workflow-header');

    assert.groupCount('Today', 3);
    assert.trimmedText('[data-test-priority-header="Delegated"]', "Delegated");
    assert.trimmedText('[data-test-priority-header="Need Response"]', "Need Response");
    assert.trimmedText('[data-test-priority-header="For Your Information"]', "For Your Information");

    assert.groupCount("Delegated::Song Change Request", 1);
    assert.groupCount("Need Response::Song Change Request", 1);
    assert.groupCount("Need Response::Request to Publish Live", 1);
    assert.groupCount("Need Response::License Request", 2);
    assert.groupCount("For Your Information::License Request", 1);
  });

  skip('List threads that match the clicked tag', async function(assert) {
    await visit('/');
    await click('.cardstack-workflow-header');
    await click('[data-test-group-counter="Need Response::License Request"]');
    assert.cardCountInThreadList(3, "All threads having the clicked tag are shown");
    assert.equal(find(".cardstack-workflow-label-with-count-wrapper.active:contains(License Request)").length, 1, "The selected group is marked as active");
    assert.equal(find("[data-test-thread-list-card]:contains(This is going to be tough, my friend.)").length, 1)
    assert.equal(find("[data-test-thread-list-card]:contains(License request for Caspian's Sycamore, please?)").length, 1)
    assert.equal(find("[data-test-thread-list-card]:contains(License request for Chris Cornell's Seasons)").length, 1)
  });

  skip('List threads that match the Today date range', async function(assert) {
    await visit('/');
    await click('.cardstack-workflow-header');
    await click('[data-test-group-counter="Today"]');
    assert.cardCountInThreadList(3);
    assert.equal(find(".cardstack-workflow-label-with-count-wrapper.active:contains(Today)").length, 1, "The selected group is marked as active");
  });

  skip('Switch between thread lists and an individual thread view', async function(assert) {
    await visit('/');
    await click('.cardstack-workflow-header');
    await click('[data-test-group-counter="Delegated::Song Change Request"]');
    await click('[data-test-thread-list-card]:first');
    // There is the summary card on top and the "normal" card in the thread
    assert.equal(find('[data-test-message-card]:contains("Could we add yet more guitars to this Caspian song?")').length, 2);

    await click('[data-test-group-counter="Need Response::Request to Publish Live"]');
    assert.cardCountInThreadList(1);

    await click('[data-test-thread-list-card]:first');
    assert.equal(find('[data-test-message-card]:contains("Could we change our previous cover of Pearl Jam\'s Daughter?")').length, 2);

    await click('[data-test-group-counter="Today"]');
    assert.cardCountInThreadList(3);
  });

  skip('Take action on a cue card', async function(assert) {
    await visit('/');
    await click('.cardstack-workflow-header');
    await click('[data-test-group-counter="Need Response::License Request"]');
    await click('[data-test-thread-list-card]:contains("License request for Caspian\'s Sycamore, please?")');
    await click('[data-test-approve-button]');

    assert.groupCount("Need Response::License Request", 1, "Unhandled group count is decremented after approving a message");
    assert.groupCount('Today', 2, "Unhandled group count is also decremented for date range group");
    assert.unhandledAlert();

    await click('[data-test-group-counter="Need Response::Request to Publish Live"]');
    await click('[data-test-thread-list-card]:last');
    await click('[data-test-deny-button]');
    await click('[data-test-read-button]'); // a chat message needs to be explicitly read - for now

    assert.noGroupCount("Need Response::Request to Publish Live", "Unhandled group count becomes zero and disappears");
    assert.unhandledAlert();
  });
});
