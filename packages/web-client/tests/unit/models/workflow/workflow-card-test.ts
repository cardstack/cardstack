import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';
import { Participant } from '../../../../app/models/workflow/workflow-postable';
import { WorkflowCard } from '@cardstack/web-client/models/workflow/workflow-card';

module('Unit | WorkflowCard model', function (hooks) {
  setupTest(hooks);

  let participant: Participant;
  hooks.beforeEach(function () {
    participant = { name: 'cardbot' };
  });

  test('isComplete starts off as false', function (assert) {
    let subject = new WorkflowCard({
      author: participant,
      componentName: 'foo/bar',
    });
    assert.equal(subject.isComplete, false);
  });

  test('when onComplete is called, isComplete is set to true', function (assert) {
    let subject = new WorkflowCard({
      author: participant,
      componentName: 'foo/bar',
    });
    subject.onComplete();
    assert.equal(subject.isComplete, true);
  });
});
