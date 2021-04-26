import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';
import WorkflowSession from '@cardstack/web-client/models/workflow/workflow-session';

module('Unit | WorkflowSession model', function (hooks) {
  setupTest(hooks);

  test('state starts off as empty', function (assert) {
    let subject = new WorkflowSession();
    assert.deepEqual(subject.state, {});
  });

  test('when update is called, state is updated', function (assert) {
    let subject = new WorkflowSession();
    subject.update('depositSourceToken', 'dai');
    assert.equal(subject.state['depositSourceToken'], 'dai');
  });
});
