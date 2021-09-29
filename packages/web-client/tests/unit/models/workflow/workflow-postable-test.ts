import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';
import { Workflow, WorkflowName } from '@cardstack/web-client/models/workflow';
import {
  Participant,
  WorkflowPostable,
} from '@cardstack/web-client/models/workflow/workflow-postable';

module('Unit | WorkflowPostable model', function (hooks) {
  setupTest(hooks);

  class ConcreteWorkflow extends Workflow {
    name = 'WITHDRAWAL' as WorkflowName;
  }

  let participant: Participant;
  hooks.beforeEach(function () {
    participant = { name: 'cardbot' };
  });

  test('isComplete starts off as false', function (assert) {
    let subject = new WorkflowPostable(participant);
    assert.equal(subject.isComplete, false);
  });

  test('passing includeIf sets up method', function (assert) {
    let subject = new WorkflowPostable(participant);
    assert.ok(!subject.includeIf);
    subject = new WorkflowPostable(participant, () => {
      return true;
    });
    assert.ok(subject.includeIf);
    assert.ok(subject.includeIf!());
  });

  test('passed participant is available as property', function (assert) {
    let subject = new WorkflowPostable(participant);
    assert.strictEqual(subject.author, participant);
  });

  test('setWorkflow does exactly that', function (assert) {
    let workflow = new ConcreteWorkflow(this.owner);
    let subject = new WorkflowPostable(participant);
    subject.setWorkflow(workflow);
    assert.strictEqual(subject.workflow, workflow);
  });
});
