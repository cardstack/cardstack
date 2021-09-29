import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';
import { settled } from '@ember/test-helpers';
import {
  WorkflowCard,
  Participant,
  WorkflowPostable,
  Milestone,
} from '@cardstack/web-client/models/workflow';
import { WorkflowStub } from '@cardstack/web-client/tests/stubs/workflow';

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

    let wf = new WorkflowStub(this.owner);
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
      async check() {
        return {
          success: false,
          reason: 'TEST',
        };
      },
    });

    class CustomWorkflowStub extends WorkflowStub {
      milestones = [
        new Milestone({
          title: 'mock. should not be completed',
          postables: [subject],
          completedDetail: 'This should never be seen',
        }),
      ];
    }
    let wf = new CustomWorkflowStub(this.owner);
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
    class CustomWorkflowStub extends WorkflowStub {
      resetTo(postable: WorkflowPostable) {
        postable.isComplete = false; // simplified version of actual implementation
      }
    }
    let wf = new CustomWorkflowStub(this.owner);
    subject.setWorkflow(wf);
    subject.onIncomplete();
    assert.equal(subject.isComplete, false);
  });
});
