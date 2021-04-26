import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, waitFor } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import { Workflow } from '@cardstack/web-client/models/workflow';
import { Milestone } from '@cardstack/web-client/models/workflow/milestone';
import { WorkflowMessage } from '@cardstack/web-client/models/workflow/workflow-message';
import { WorkflowPostable } from '@cardstack/web-client/models/workflow/workflow-postable';
import PostableCollection from '@cardstack/web-client/models/workflow/postable-collection';

module('Integration | Component | workflow-thread', function (hooks) {
  setupRenderingTest(hooks);

  class ConcreteWorkflow extends Workflow {}

  test('it renders before-content named block', async function (assert) {
    this.set('workflow', new ConcreteWorkflow(this.owner));
    await render(hbs`
      <WorkflowThread @workflow={{this.workflow}}>
        <:before-content>
          <div data-test-hello-world>Hello world</div>
        </:before-content>
      </WorkflowThread>
    `);

    assert.dom('[data-test-hello-world]').exists();
    assert.dom('[data-test-workflow-thread]').isFocused();
  });

  test('it renders date divider before first post and when the date changes', async function (assert) {
    let workflow = new ConcreteWorkflow(this.owner);
    let postable1 = new WorkflowMessage({
      author: { name: 'cardbot' },
      message: 'Hello world',
    });
    let postable2 = new WorkflowMessage({
      author: { name: 'cardbot' },
      message: 'How are you today?',
    });
    let postable3 = new WorkflowMessage({
      author: { name: 'joe' },
      message: 'Fine thank you.',
    });
    let postable4 = new WorkflowMessage({
      author: { name: 'steve' },
      message: 'One more thing...',
    });

    workflow.milestones = [
      new Milestone({
        title: 'First milestone',
        postables: [postable1],
        completedDetail: 'You are number one!',
      }),
      new Milestone({
        title: 'Second milestone',
        postables: [postable2, postable3],
        completedDetail: 'Had to do number two!',
      }),
    ];
    workflow.epilogue.postables = [postable4];
    postable1.timestamp = new Date(Date.parse('2021-05-20 00:00:00'));
    postable2.timestamp = new Date(Date.parse('2021-05-20 00:00:00'));
    postable3.timestamp = new Date(Date.parse('2021-05-21 00:00:00'));
    postable4.timestamp = new Date(Date.parse('2021-05-21 00:00:00'));
    this.set('workflow', workflow);
    workflow.attachWorkflow();
    await render(hbs`
      <WorkflowThread @workflow={{this.workflow}} />
    `);
    assert.dom('[data-test-date-divider]').exists({ count: 2 });
    assert.dom('[data-test-workflow-thread]').isFocused();
  });

  test('it renders epilogue posts after the workflow is complete', async function (assert) {
    let workflow = new ConcreteWorkflow(this.owner);
    let postable1 = new WorkflowPostable({ name: 'cardbot' });
    workflow.milestones = [
      new Milestone({
        title: 'First milestone',
        postables: [postable1],
        completedDetail: 'You are number one!',
      }),
    ];
    workflow.epilogue = new PostableCollection([
      new WorkflowMessage({
        author: { name: 'cardbot' },
        message: 'This is the epilogue',
      }),
    ]);
    this.set('workflow', workflow);
    workflow.attachWorkflow();
    await render(hbs`
      <WorkflowThread @workflow={{this.workflow}} />
    `);
    assert.dom('[data-test-epilogue][data-test-postable]').doesNotExist();
    postable1.isComplete = true;
    await waitFor('[data-test-epilogue][data-test-postable]');
    assert
      .dom('[data-test-epilogue][data-test-postable]')
      .hasTextContaining('This is the epilogue');
  });
});
