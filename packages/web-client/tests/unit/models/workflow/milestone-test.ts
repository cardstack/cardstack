import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';
import {
  Milestone,
  Participant,
  WorkflowPostable,
} from '@cardstack/web-client/models/workflow';
import { WorkflowStub } from '@cardstack/web-client/tests/stubs/workflow';

module('Unit | Milestone model', function (hooks) {
  setupTest(hooks);
  let subject: Milestone;

  module('an empty Milestone', function (hooks) {
    hooks.beforeEach(function () {
      subject = new Milestone({
        title: 'First Milestone',
        postables: [],
        completedDetail: 'First in da bag',
      });
    });
    test('visiblePostables is empty', function (assert) {
      assert.deepEqual(subject.visiblePostables, []);
    });
    test('isComplete is true', function (assert) {
      assert.ok(subject.isComplete);
    });
  });

  module('a Milestone with postables', function (hooks) {
    let author: Participant;
    let postable1: WorkflowPostable;
    let postable2: WorkflowPostable;
    let postable3: WorkflowPostable;
    let shouldInclude = false;

    hooks.beforeEach(function () {
      author = { name: 'cardbot' };
      postable1 = new WorkflowPostable(author);
      (postable1 as any).name = 'postable1';
      postable2 = new WorkflowPostable(author, () => {
        return shouldInclude;
      });
      (postable1 as any).name = 'postable1';
      postable3 = new WorkflowPostable(author);
      subject = new Milestone({
        title: 'First Milestone',
        postables: [postable1, postable2, postable3],
        completedDetail: 'First in da bag',
      });
    });
    test('visiblePostables includes only first incomplete postable', function (assert) {
      assert.deepEqual(subject.visiblePostables, [postable1]);
      postable1.isComplete = true;
      assert.deepEqual(subject.visiblePostables, [postable1, postable3]);
    });

    test('timestamps are set on postable once they are part of visiblePostables', function (assert) {
      assert.notOk(postable1.timestamp);
      assert.notOk(postable2.timestamp);
      assert.notOk(postable3.timestamp);
      subject.visiblePostables; // invoke for side effect
      assert.ok(postable1.timestamp);
      assert.notOk(postable2.timestamp);
      postable1.isComplete = true;
      subject.visiblePostables; // invoke for side effect
      assert.ok(postable3.timestamp);
      assert.deepEqual(subject.visiblePostables, [postable1, postable3]);
    });

    test('isComplete is false until all postables complete (except excluded)', function (assert) {
      subject.visiblePostables; // invoke for side effect
      assert.notOk(subject.isComplete);
      postable1.isComplete = true;
      subject.visiblePostables; // invoke for side effect
      assert.notOk(subject.isComplete);
      postable3.isComplete = true;
      subject.visiblePostables; // invoke for side effect
      assert.ok(subject.isComplete);
    });

    test('setWorkflow does exactly that', function (assert) {
      let workflow = new WorkflowStub(this.owner);
      subject.setWorkflow(workflow);
      assert.strictEqual(subject.workflow, workflow);
    });
  });

  module('editable state', function (hooks) {
    let author: Participant;
    let postable1: WorkflowPostable;

    hooks.beforeEach(function () {
      author = { name: 'cardbot' };
      postable1 = new WorkflowPostable(author);
      (postable1 as any).name = 'postable1';
      (postable1 as any).name = 'postable1';
    });

    test('isEditable is true by default', function (assert) {
      let subject = new Milestone({
        title: 'First Milestone',
        postables: [postable1],
        completedDetail: 'First in da bag',
      });
      assert.true(subject.isEditable);
    });

    test('isEditable is false if editableIf returns false', function (assert) {
      let subject = new Milestone({
        title: 'First Milestone',
        postables: [postable1],
        completedDetail: 'First in da bag',
        editableIf() {
          return false;
        },
      });
      subject.setWorkflow(new WorkflowStub(this.owner));
      assert.false(subject.isEditable);
    });

    test('isEditable is true if editableIf returns true', function (assert) {
      let subject = new Milestone({
        title: 'First Milestone',
        postables: [postable1],
        completedDetail: 'First in da bag',
        editableIf() {
          return true;
        },
      });
      subject.setWorkflow(new WorkflowStub(this.owner));
      assert.true(subject.isEditable);
    });
  });
});
