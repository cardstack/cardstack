import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';
import {
  Milestone,
  PostableCollection,
  WorkflowCard,
  WorkflowMessage,
} from '@cardstack/ssr-web/models/workflow';
import AnimatedWorkflow from '@cardstack/ssr-web/models/animated-workflow';
import { settled } from '@ember/test-helpers';
import { WorkflowStub } from '@cardstack/ssr-web/tests/stubs/workflow';

let message = (message: string = 'Default message') =>
  new WorkflowMessage({
    author: { name: 'cardbot' },
    message,
  });

let card = (complete?: boolean) => {
  let result = new WorkflowCard({
    author: { name: 'cardbot' },
    componentName: 'foo/bar',
  });
  if (complete) {
    result.isComplete = true;
  }
  return result;
};

let animatedWorkflow: AnimatedWorkflow | null = null;

module('Unit | AnimatedWorkflow model', function (hooks) {
  setupTest(hooks);

  hooks.afterEach(function () {
    animatedWorkflow?.destroy();
  });

  test("It uses the wrapped workflow's milestones to model its milestones", async function (assert) {
    let workflow = new WorkflowStub(this.owner);
    workflow.milestones = [
      new Milestone({
        title: 'Milestone 1',
        postables: [],
        completedDetail: 'Milestone 1 finished',
      }),
      new Milestone({
        title: 'Milestone 2',
        postables: [],
        completedDetail: 'Milestone 2 finished',
      }),
    ];
    workflow.attachWorkflow();
    animatedWorkflow = new AnimatedWorkflow(workflow);

    assert.equal(animatedWorkflow.milestones[0].model, workflow.milestones[0]);
    assert.equal(
      animatedWorkflow.milestones[0].title,
      workflow.milestones[0].title,
      'The animated milestones should have the same title'
    );
    assert.equal(
      animatedWorkflow.milestones[0].completedDetail,
      workflow.milestones[0].completedDetail,
      'The animated milestones should have the same completedDetail'
    );
    assert.equal(animatedWorkflow.milestones[1].model, workflow.milestones[1]);
    assert.equal(
      animatedWorkflow.milestones[1].title,
      workflow.milestones[1].title,
      'The animated milestones should have the same title'
    );
    assert.equal(
      animatedWorkflow.milestones[1].completedDetail,
      workflow.milestones[1].completedDetail,
      'The animated milestones should have the same completedDetail'
    );
  });

  test("It reflects the wrapped workflow's isCanceled property", async function (assert) {
    let workflow = new WorkflowStub(this.owner);
    workflow.milestones = [
      new Milestone({
        title: 'Unfinished milestone',
        postables: [message(), card()],
        completedDetail: 'Not finished',
      }),
    ];
    workflow.attachWorkflow();
    animatedWorkflow = new AnimatedWorkflow(workflow);

    assert.ok(!workflow.isCanceled, "Workflow isn't canceled at the start");
    assert.equal(
      animatedWorkflow.isCanceled,
      workflow.isCanceled,
      'Value of isCanceled is the same on animated and wrapped workflow'
    );

    workflow.cancel('TEST');

    assert.ok(workflow.isCanceled, 'workflow is now canceled');
    assert.equal(
      animatedWorkflow.isCanceled,
      workflow.isCanceled,
      'Value of isCanceled is the same on animated and wrapped workflow'
    );
  });

  test('It can progress as the underlying workflow progresses through milestones', async function (assert) {
    let workflow = new WorkflowStub(this.owner);
    let target1 = card();
    let target2 = card();
    let target3 = card();

    workflow.milestones = [
      new Milestone({
        title: 'Milestone 1',
        postables: [message(), target1, target2],
        completedDetail: 'Milestone 1 finished',
      }),
      new Milestone({
        title: 'Milestone 2',
        postables: [message(), target3],
        completedDetail: 'Milestone 2 finished',
      }),
      new Milestone({
        title: 'Milestone 3',
        postables: [message()],
        completedDetail: 'Milestone 3 finished',
      }),
    ];
    workflow.attachWorkflow();
    animatedWorkflow = new AnimatedWorkflow(workflow);

    assert.equal(animatedWorkflow.completedMilestoneCount, 0);

    target1.onComplete();
    await settled();
    assert.equal(
      animatedWorkflow.visibleMilestones[0].visiblePostables.length,
      3
    );

    target2.onComplete();
    await settled();
    assert.equal(
      animatedWorkflow.visibleMilestones[0].visiblePostables.length,
      3,
      '3 postables should be visible for the first milestone'
    );
    assert.equal(
      animatedWorkflow.visibleMilestones[1].visiblePostables.length,
      2,
      '2 postables should be visible for the second milestone'
    );
    assert.equal(
      animatedWorkflow.completedMilestoneCount,
      1,
      '1 milestone is completed'
    );

    target3.onComplete();
    await settled();
    assert.equal(
      animatedWorkflow.completedMilestoneCount,
      3,
      '3 milestones are completed'
    );

    assert.ok(animatedWorkflow.isComplete, 'The workflow should be completed');
  });

  test('It can show an appropriate workflow progress status (milestone, canceled, started)', async function (assert) {
    let workflow = new WorkflowStub(this.owner);
    let target1 = card();
    let target2 = card();

    workflow.milestones = [
      new Milestone({
        title: 'Milestone 1',
        postables: [message(), target1],
        completedDetail: 'Milestone 1 finished',
      }),
      new Milestone({
        title: 'Milestone 2',
        postables: [message(), target2],
        completedDetail: 'Milestone 2 finished',
      }),
      new Milestone({
        title: 'Milestone 3',
        postables: [card()],
        completedDetail: 'Milestone 3 finished',
      }),
    ];
    workflow.attachWorkflow();
    animatedWorkflow = new AnimatedWorkflow(workflow);

    assert.equal(animatedWorkflow.progressStatus, 'Workflow started');

    target1.onComplete();
    await settled();
    assert.equal(animatedWorkflow.progressStatus, 'Milestone 1 finished');

    target2.onComplete();
    await settled();
    assert.equal(animatedWorkflow.progressStatus, 'Milestone 2 finished');

    workflow.cancel('TEST');
    assert.equal(animatedWorkflow.progressStatus, 'Workflow canceled');
  });

  test('It makes cancelationMessages visible after the workflow is canceled', async function (assert) {
    let workflow = new WorkflowStub(this.owner);

    workflow.milestones = [
      new Milestone({
        title: 'Milestone 1',
        postables: [message(), card()],
        completedDetail: 'Milestone 1 finished',
      }),
    ];
    workflow.cancelationMessages = new PostableCollection([message(), card()]);
    workflow.attachWorkflow();
    animatedWorkflow = new AnimatedWorkflow(workflow);

    assert.equal(
      animatedWorkflow.cancelationMessages.visiblePostables.length,
      0
    );

    workflow.cancel('TEST');
    await settled();

    assert.equal(
      animatedWorkflow.cancelationMessages.visiblePostables.length,
      2,
      '2 cancelation messages are made visible after the workflow is canceled'
    );
  });

  test('It makes the epilogue visible after the workflow is completed', async function (assert) {
    let workflow = new WorkflowStub(this.owner);
    let target1 = card();

    workflow.milestones = [
      new Milestone({
        title: 'Milestone 1',
        postables: [message(), target1],
        completedDetail: 'Milestone 1 finished',
      }),
    ];
    workflow.epilogue = new PostableCollection([message(), card()]);
    workflow.attachWorkflow();
    animatedWorkflow = new AnimatedWorkflow(workflow);

    assert.equal(animatedWorkflow.epilogue.visiblePostables.length, 0);

    target1.onComplete();
    await settled();

    assert.equal(
      animatedWorkflow.epilogue.visiblePostables.length,
      2,
      '2 epilogue messages are made visible after the workflow is completed'
    );
  });

  test('It can roll back a workflow when the wrapped workflow is rolled back', async function (assert) {
    let workflow = new WorkflowStub(this.owner);
    let target1 = card(true);

    workflow.milestones = [
      new Milestone({
        title: 'Milestone 1',
        postables: [message(), target1, message()],
        completedDetail: 'Milestone 1 finished',
      }),
      new Milestone({
        title: 'Milestone 2',
        postables: [message(), message()],
        completedDetail: 'Milestone 2 finished',
      }),
      new Milestone({
        title: 'Milestone 3',
        postables: [card()],
        completedDetail: 'Milestone 3 finished',
      }),
    ];
    workflow.attachWorkflow();
    animatedWorkflow = new AnimatedWorkflow(workflow);

    await settled();

    assert.equal(
      animatedWorkflow.completedMilestoneCount,
      2,
      'The workflow starts off with 2 completed milestones'
    );
    assert.equal(
      animatedWorkflow.visibleMilestones[0].visiblePostables.length,
      3,
      'The first milestone has 3 visible postables'
    );

    target1.onIncomplete();

    assert.equal(
      animatedWorkflow.completedMilestoneCount,
      0,
      'After onIncomplete is called on the target, there are no completed milestones'
    );
    assert.equal(
      animatedWorkflow.visibleMilestones[0].visiblePostables.length,
      2,
      'The first milestone has 2 visible postables'
    );
  });
});
