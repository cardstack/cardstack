import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, settled, waitFor } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import {
  Milestone,
  PostableCollection,
  Workflow,
  WorkflowMessage,
  WorkflowPostable,
  WorkflowCard,
  WorkflowName,
} from '@cardstack/web-client/models/workflow';

module('Integration | Component | workflow-thread', function (hooks) {
  setupRenderingTest(hooks);

  class ConcreteWorkflow extends Workflow {
    name = 'WITHDRAWAL' as WorkflowName;
  }

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

    // new Date(year, monthIndex, day, hour, minute, second)
    postable1.timestamp = new Date(2021, 4, 20, 0, 0, 0);
    postable2.timestamp = new Date(2021, 4, 20, 0, 0, 0);
    postable3.timestamp = new Date(2021, 4, 21, 0, 0, 0);
    postable4.timestamp = new Date(2021, 4, 21, 0, 0, 0);

    this.set('workflow', workflow);
    workflow.attachWorkflow();
    await render(hbs`
      <WorkflowThread @workflow={{this.workflow}} />
    `);
    assert.dom('[data-test-date-divider]').exists({ count: 2 });
    assert.dom('[data-test-workflow-thread]').isFocused();
  });

  test('it uses the appropriate text for milestone statuses', async function (assert) {
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
            message: 'Hello world',
          }),
        ],
        completedDetail: 'Had to do number two!',
      }),
      new Milestone({
        title: 'Third milestone',
        postables: [
          new WorkflowMessage({
            author: { name: 'cardbot' },
            message: 'Hello world',
          }),
        ],
        completedDetail: 'Finished',
      }),
    ];

    this.set('workflow', workflow);
    workflow.attachWorkflow();
    await render(hbs`
      <WorkflowThread @workflow={{this.workflow}} />
    `);
    assert
      .dom('[data-test-milestone-completed][data-test-milestone="0"]')
      .containsText('Milestone reached');
    assert
      .dom('[data-test-milestone-completed][data-test-milestone="1"]')
      .containsText('Milestone reached');
    assert
      .dom('[data-test-milestone-completed][data-test-milestone="2"]')
      .containsText(
        'Workflow completed',
        "Final milestone should have text 'Workflow completed'"
      );
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

  test('it renders cancelation posts after the workflow is canceled', async function (assert) {
    let workflow = new ConcreteWorkflow(this.owner);
    workflow.milestones = [
      new Milestone({
        title: 'First milestone',
        postables: [
          new WorkflowPostable({ name: 'cardbot' }),
          new WorkflowPostable({ name: 'cardbot' }),
        ],
        completedDetail: 'You are number one!',
      }),
    ];
    workflow.cancelationMessages = new PostableCollection([
      new WorkflowMessage({
        author: { name: 'cardbot' },
        message: 'You canceled the workflow!',
      }),
    ]);
    this.set('workflow', workflow);
    workflow.attachWorkflow();

    await render(hbs`
      <WorkflowThread @workflow={{this.workflow}} />
    `);

    assert.dom('[data-test-postable]').exists({ count: 1 });
    assert.dom('[data-test-cancelation][data-test-postable]').doesNotExist();

    workflow.cancel('TEST');

    await waitFor('[data-test-cancelation][data-test-postable]');
    assert.dom('[data-test-postable]').exists({ count: 2 });
    assert
      .dom('[data-test-cancelation][data-test-postable]')
      .hasTextContaining('You canceled the workflow!');
  });

  test('A workflow can be rolled back', async function (assert) {
    this.owner.register(
      'template:components/dummy-test',
      hbs`
        <div>Just a dummy component so we don't have to depend on existing components for this test</div>
        `
    );

    let workflow = new ConcreteWorkflow(this.owner);
    let message = () =>
      new WorkflowMessage({
        author: { name: 'cardbot' },
        message: 'A message',
      });

    let target = new WorkflowCard({
      author: { name: 'cardbot' },
      componentName: 'dummy-test',
    });
    target.isComplete = true;

    workflow.milestones = [
      new Milestone({
        title: 'First milestone',
        postables: [message(), target],
        completedDetail: 'You are number one!',
      }),
      new Milestone({
        title: 'Second milestone',
        postables: [message(), message()],
        completedDetail: 'You are number two!',
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

    assert.dom('[data-test-milestone="0"]').isVisible();
    assert.dom('[data-test-milestone="1"]').isVisible();

    target.onIncomplete();
    await settled();

    assert.dom('[data-test-milestone="1"]').doesNotExist();
    assert
      .dom('[data-test-milestone="0"][data-test-milestone-completed]')
      .doesNotExist();
  });
});
