import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import { Workflow } from '@cardstack/web-client/models/workflow';
import { Milestone } from '@cardstack/web-client/models/workflow/milestone';
import { WorkflowMessage } from '@cardstack/web-client/models/workflow/workflow-message';

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
  });

  test('it renders date divider before first post and when the date changes', async function (assert) {
    let workflow = new ConcreteWorkflow(this.owner);
    workflow.milestones = [
      new Milestone({
        title: 'First milestone',
        postables: [
          new WorkflowMessage({
            author: { name: 'cardbot' },
            message: 'Hello world',
          }),
        ],
        completedDetail: 'You are number one!',
      }),
      new Milestone({
        title: 'Second milestone',
        postables: [
          new WorkflowMessage({
            author: { name: 'cardbot' },
            message: 'How are you today?',
          }),
          new WorkflowMessage({
            author: { name: 'joe' },
            message: 'Fine thank you.',
          }),
        ],
        completedDetail: 'Had to do number two!',
      }),
    ];
    workflow.milestones[0].postables[0].timestamp = new Date(
      Date.parse('2021-05-20 00:00:00')
    );
    workflow.milestones[1].postables[0].timestamp = new Date(
      Date.parse('2021-05-20 00:00:00')
    );
    workflow.milestones[1].postables[1].timestamp = new Date(
      Date.parse('2021-05-21 00:00:00')
    );
    this.set('workflow', workflow);
    workflow.attachWorkflow();
    await render(hbs`
      <WorkflowThread @workflow={{this.workflow}} />
    `);
    assert.dom('[data-test-date-divider]').exists({ count: 2 });
  });
});
