import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';
import {
  Milestone,
  PostableCollection,
  Workflow,
  WorkflowCard,
  WorkflowMessage,
  WorkflowName,
  WorkflowPostable,
} from '@cardstack/web-client/models/workflow';

module('Unit | Workflow model', function (hooks) {
  setupTest(hooks);

  class ConcreteWorkflow extends Workflow {
    name = 'WITHDRAWAL' as WorkflowName;
  }

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
    let workflow = new ConcreteWorkflow(this.owner);
    workflow.milestones = [exampleMilestone];
    assert.ok(!exampleMilestone.workflow);
    workflow.attachWorkflow();
    assert.strictEqual(workflow, exampleMilestone.workflow);
  });

  test('attachWorkflow sets workflow on epiloguePostables', function (assert) {
    let workflow = new ConcreteWorkflow(this.owner);
    workflow.milestones = [exampleMilestone];
    workflow.epilogue.postables = [exampleMessage];
    assert.ok(!exampleMessage.workflow);
    workflow.attachWorkflow();
    assert.strictEqual(workflow, exampleMessage.workflow);
  });

  test('attachWorkflow sets workflow on cancelationMessages', function (assert) {
    let workflow = new ConcreteWorkflow(this.owner);
    workflow.milestones = [exampleMilestone];
    workflow.cancelationMessages = new PostableCollection([exampleMessage]);
    assert.ok(!exampleMessage.workflow);
    workflow.attachWorkflow();
    assert.strictEqual(workflow, exampleMessage.workflow);
  });

  test('completedMilestoneCount returns count of milestones with isComplete true', function (assert) {
    let workflow = new ConcreteWorkflow(this.owner);
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

  test('visibleMilestones returns milestones up to and including first incomplete milestone', function (assert) {
    let workflow = new ConcreteWorkflow(this.owner);
    let milestone2Postable = new WorkflowPostable({ name: 'cardbot' });
    milestone2Postable.isComplete = false;

    let secondMilestone = new Milestone({
      title: 'Milestone 2',
      postables: [milestone2Postable],
      completedDetail: 'Second mile-stoned!',
    });

    workflow.milestones = [exampleMilestone, secondMilestone];
    assert.deepEqual(workflow.visibleMilestones, [exampleMilestone]);
    examplePostable.isComplete = true;
    assert.deepEqual(workflow.visibleMilestones, [
      exampleMilestone,
      secondMilestone,
    ]);
    milestone2Postable.isComplete = true;
    assert.deepEqual(workflow.visibleMilestones, [
      exampleMilestone,
      secondMilestone,
    ]);
    examplePostable.isComplete = false;
    assert.deepEqual(workflow.visibleMilestones, [exampleMilestone]);
  });

  test('progressStatus returns the "completedDetail" of the last complete milestone', function (assert) {
    let workflow = new ConcreteWorkflow(this.owner);
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

  test('progressStatus returns "Workflow started" when no milestones are complete', function (assert) {
    let workflow = new ConcreteWorkflow(this.owner);
    workflow.milestones = [exampleMilestone];
    assert.equal(workflow.progressStatus, 'Workflow started');
  });

  test('progressStatus returns "Workflow canceled" when workflow is canceled', function (assert) {
    let workflow = new ConcreteWorkflow(this.owner);
    workflow.milestones = [exampleMilestone];
    workflow.cancel('TEST');
    assert.equal(workflow.progressStatus, 'Workflow canceled');
  });

  test('Incomplete workflow is canceled when workflow.cancel is called', function (assert) {
    let workflow = new ConcreteWorkflow(this.owner);
    workflow.milestones = [exampleMilestone];
    workflow.cancel('TEST');
    assert.equal(workflow.isCanceled, true);
    assert.equal(workflow.cancelationReason, 'TEST');
  });

  test('Workflow cannot be canceled twice', function (assert) {
    let workflow = new ConcreteWorkflow(this.owner);
    workflow.milestones = [exampleMilestone];
    workflow.cancel('FIRST');
    workflow.cancel('SECOND');
    assert.equal(workflow.isCanceled, true);
    assert.equal(workflow.cancelationReason, 'FIRST');
  });

  test('Completed workflow is not canceled when workflow.cancel is called', function (assert) {
    let workflow = new ConcreteWorkflow(this.owner);
    workflow.milestones = [exampleMilestone];
    examplePostable.isComplete = true;

    assert.ok(workflow.isComplete, 'Completing workflow before canceling');
    workflow.cancel('TEST');
    assert.ok(!workflow.isCanceled);
  });

  test('Workflow.resetTo resets each milestone and its epilogue correctly', function (assert) {
    const testWorkflow = new ConcreteWorkflow(this.owner);
    let indicesArray: string[] = [];

    class DummyResetFromEpilogue extends PostableCollection {
      resetFrom(index: number) {
        indicesArray.push(`epilogue-${index}`);
      }
    }

    class DummyResetFromMilestone extends Milestone {
      milestoneIndex: number;
      constructor(initArgs: any, milestoneIndex: number) {
        super(initArgs);
        this.milestoneIndex = milestoneIndex;
      }

      resetFrom(index: number) {
        indicesArray.push(`${this.milestoneIndex}-${index}`);
      }
    }

    const createPostable = () =>
      new WorkflowCard({
        author: { name: 'cardbot' },
        componentName: 'foo/bar',
      });

    let targetPostable1 = createPostable();
    let targetPostable2 = createPostable();
    let epiloguePostable = createPostable();

    let milestones = [
      new DummyResetFromMilestone(
        {
          title: 'Milestone 1',
          postables: [createPostable(), createPostable(), targetPostable1],
          completedDetail: 'Milestone 1 done',
        },
        0
      ),
      new DummyResetFromMilestone(
        {
          title: 'Milestone 2',
          postables: [createPostable(), targetPostable2, createPostable()],
          completedDetail: 'Milestone 1 done',
        },
        1
      ),
      new DummyResetFromMilestone(
        {
          title: 'Milestone 3',
          postables: [createPostable(), createPostable()],
          completedDetail: 'Milestone 3 done',
        },
        2
      ),
    ];
    testWorkflow.milestones = milestones;
    testWorkflow.epilogue = new DummyResetFromEpilogue([
      createPostable(),
      epiloguePostable,
    ]);
    testWorkflow.attachWorkflow();
    testWorkflow.resetTo(targetPostable1);
    assert.equal(indicesArray.length, 4);
    assert.ok(indicesArray.includes('0-2'));
    assert.ok(indicesArray.includes('1-0'));
    assert.ok(indicesArray.includes('2-0'));
    assert.ok(indicesArray.includes('epilogue-0'));

    indicesArray = [];

    testWorkflow.resetTo(targetPostable2);
    assert.equal(indicesArray.length, 3);
    assert.ok(indicesArray.includes('1-1'));
    assert.ok(indicesArray.includes('2-0'));
    assert.ok(indicesArray.includes('epilogue-0'));

    indicesArray = [];

    testWorkflow.resetTo(epiloguePostable);
    assert.equal(indicesArray.length, 1);
    assert.ok(indicesArray.includes('epilogue-1'));
  });

  module('with includeIf', function (hooks) {
    let workflow: Workflow;
    let calledIncludeIf: boolean;

    hooks.beforeEach(function () {
      workflow = new ConcreteWorkflow(this.owner);
      calledIncludeIf = false;
      let secondMilestone = new Milestone({
        title: 'Milestone 2',
        postables: [
          new WorkflowPostable(
            {
              name: 'cardbot',
            },
            () => {
              calledIncludeIf = true;
              return false;
            }
          ),
        ],
        completedDetail: 'Second mile-stoned',
      });
      workflow.milestones = [exampleMilestone, secondMilestone];
    });

    test('includeIf called only once a postable is a candidate for display', async function (assert) {
      // simulate calls made while rendering a workflow
      workflow.visibleMilestones.map((milestone) => milestone.visiblePostables);
      workflow.isComplete;
      workflow.progressStatus;
      assert.equal(
        calledIncludeIf,
        false,
        'includeIf for the second milestone’s postables was NOT called'
      );
      examplePostable.isComplete = true;
      workflow.visibleMilestones.map((milestone) => milestone.visiblePostables);
      assert.equal(
        calledIncludeIf,
        true,
        'includeIf for the second milestone’s postables was called'
      );
    });
  });
});
