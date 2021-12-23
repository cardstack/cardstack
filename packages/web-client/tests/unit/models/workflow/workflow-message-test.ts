import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';
import { WorkflowMessage } from '@cardstack/web-client/models/workflow/workflow-message';
import { Participant } from '@cardstack/web-client/models/workflow/workflow-postable';

module('Unit | WorkflowMessage model', function (hooks) {
  setupTest(hooks);

  let participant: Participant;
  hooks.beforeEach(function () {
    participant = { name: 'cardbot' };
  });

  test('isComplete starts off as true', function (assert) {
    let subject = new WorkflowMessage({
      author: participant,
      message: 'Hello, world',
    });
    assert.true(subject.isComplete);
  });
});
