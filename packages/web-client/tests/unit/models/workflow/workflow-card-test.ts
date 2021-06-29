import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';
import {
  Participant,
  WorkflowPostable,
} from '@cardstack/web-client/models/workflow/workflow-postable';
import { WorkflowCard } from '@cardstack/web-client/models/workflow/workflow-card';
import { Workflow } from '@cardstack/web-client/models/workflow';
import { settled } from '@ember/test-helpers';
import { Milestone } from '@cardstack/web-client/models/workflow/milestone';

module('Unit | WorkflowCard model', function (hooks) {
  setupTest(hooks);

  let participant: Participant;
  hooks.beforeEach(function () {
    participant = { name: 'cardbot' };
  });

  test('setWorkflow makes session available', function (assert) {
    let subject = new WorkflowCard({
      author: participant,
      componentName: 'foo/bar',
    });
    class StubWorkflow extends Workflow {}
    let wf = new StubWorkflow(this.owner);
    subject.setWorkflow(wf);
    assert.equal(subject.session, wf.session);
  });

  test('isComplete starts off as false', function (assert) {
    let subject = new WorkflowCard({
      author: participant,
      componentName: 'foo/bar',
    });
    assert.equal(subject.isComplete, false);
  });

  test('when onComplete is called, isComplete is set to true', async function (assert) {
    let subject = new WorkflowCard({
      author: participant,
      componentName: 'foo/bar',
    });
    subject.onComplete();
    await settled();
    assert.equal(subject.isComplete, true);
  });

  test("when onComplete is called, the card's check method is called and the card's workflow is canceled", async function (assert) {
    let subject = new WorkflowCard({
      author: participant,
      componentName: 'foo/bar',
      failureReason: 'TEST',
      async check() {
        return false;
      },
    });

    class StubWorkflow extends Workflow {
      milestones = [
        new Milestone({
          title: 'mock. should not be completed',
          postables: [subject],
          completedDetail: 'This should never be seen',
        }),
      ];
    }
    let wf = new StubWorkflow(this.owner);
    subject.setWorkflow(wf);

    subject.onComplete();
    await settled();
    assert.equal(subject.isComplete, false);
    assert.equal(wf.isCanceled, true);
    assert.equal(wf.cancelationReason, 'TEST');
  });

  test('when onIncomplete is called, workflow is called', function (assert) {
    let subject = new WorkflowCard({
      author: participant,
      componentName: 'foo/bar',
    });
    class StubWorkflow extends Workflow {
      resetTo(postable: WorkflowPostable) {
        postable.isComplete = false; // simplified version of actual implementation
      }
    }
    let wf = new StubWorkflow(this.owner);
    subject.setWorkflow(wf);
    subject.onIncomplete();
    assert.equal(subject.isComplete, false);
  });
});
