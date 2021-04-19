import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';
import { Milestone } from '@cardstack/web-client/models/workflow/milestone';
import { Workflow } from '@cardstack/web-client/models/workflow';
import { WorkflowMessage } from '@cardstack/web-client/models/workflow/workflow-message';
import { WorkflowPostable } from '@cardstack/web-client/models/workflow/workflow-postable';

module('Unit | Workflow model', function (hooks) {
  setupTest(hooks);

  class ConcreteWorkflow extends Workflow {}
  let exampleMilestone: Milestone;
  let exampleMessage: WorkflowMessage;
  let examplePostable: WorkflowPostable;

  hooks.beforeEach(function () {
    exampleMessage = new WorkflowMessage({
      author: { name: 'cardbot' },
      message: 'This is my message to you.',
    });
    examplePostable = new WorkflowPostable({ name: 'cardbot' });
    examplePostable.isComplete = false;
    exampleMilestone = new Milestone({
      title: 'Milestone 1',
      postables: [examplePostable],
      completedDetail: 'First milestone in the bag',
    });
  });

  test('attachWorkflow sets workflow on milestones', function (assert) {
    let workflow = new ConcreteWorkflow({});
    workflow.milestones = [exampleMilestone];
    assert.ok(!exampleMilestone.workflow);
    workflow.attachWorkflow();
    assert.strictEqual(workflow, exampleMilestone.workflow);
  });

  test('attachWorkflow sets workflow on epiloguePostables', function (assert) {
    let workflow = new ConcreteWorkflow({});
    workflow.milestones = [exampleMilestone];
    workflow.epilogue.postables = [exampleMessage];
    assert.ok(!exampleMessage.workflow);
    workflow.attachWorkflow();
    assert.strictEqual(workflow, exampleMessage.workflow);
  });

  test('completedMilestoneCount returns count of milestones with isComplete true', function (assert) {
    let workflow = new ConcreteWorkflow({});
    let milestone2Postable = new WorkflowPostable({ name: 'cardbot' });
    milestone2Postable.isComplete = false;

    let secondMilestone = new Milestone({
      title: 'Milestone 2',
      postables: [milestone2Postable],
      completedDetail: 'Second mile-stoned!',
    });

    workflow.milestones = [exampleMilestone, secondMilestone];
    assert.equal(workflow.completedMilestoneCount, 0);
    examplePostable.isComplete = true;
    assert.equal(workflow.completedMilestoneCount, 1);
    milestone2Postable.isComplete = true;
    assert.equal(workflow.completedMilestoneCount, 2);
  });

  test('progressStatus returns the "completedDetail" of the last complete milestone', function (assert) {
    let workflow = new ConcreteWorkflow({});
    let milestone2Postable = new WorkflowPostable({ name: 'cardbot' });
    milestone2Postable.isComplete = false;

    let secondMilestone = new Milestone({
      title: 'Milestone 2',
      postables: [milestone2Postable],
      completedDetail: 'Second mile-stoned!',
    });

    workflow.milestones = [exampleMilestone, secondMilestone];
    examplePostable.isComplete = true;
    assert.equal(workflow.progressStatus, exampleMilestone.completedDetail);
    milestone2Postable.isComplete = true;
    assert.equal(workflow.progressStatus, secondMilestone.completedDetail);
  });

  test('progressStatus returns "Workflow Started" when no milestones are complete', function (assert) {
    let workflow = new ConcreteWorkflow({});
    workflow.milestones = [exampleMilestone];
    assert.equal(workflow.progressStatus, 'Workflow Started');
  });
});
