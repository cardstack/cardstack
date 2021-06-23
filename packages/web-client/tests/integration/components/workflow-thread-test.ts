import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { find, render, settled, waitFor, waitUntil } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import { Workflow } from '@cardstack/web-client/models/workflow';
import { Milestone } from '@cardstack/web-client/models/workflow/milestone';
import { WorkflowMessage } from '@cardstack/web-client/models/workflow/workflow-message';
import { WorkflowPostable } from '@cardstack/web-client/models/workflow/workflow-postable';
import PostableCollection from '@cardstack/web-client/models/workflow/postable-collection';
import { WorkflowCard } from '@cardstack/web-client/models/workflow/workflow-card';

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

    workflow.cancel();

    await waitFor('[data-test-cancelation][data-test-postable]');
    assert.dom('[data-test-postable]').exists({ count: 2 });
    assert
      .dom('[data-test-cancelation][data-test-postable]')
      .hasTextContaining('You canceled the workflow!');
  });

  test('A workflow can be rolled back', async function (assert) {
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

  test('a docked footer message shows when more messages are hidden below', async function (assert) {
    this.owner.register(
      'template:components/dummy-tall',
      hbs`
        {{!-- template-lint-disable no-inline-styles --}}
        <div style="height: 10000px">A very tall component</div>
        It is done.`
    );

    let workflow = new ConcreteWorkflow(this.owner);
    let message = () =>
      new WorkflowMessage({
        author: { name: 'cardbot' },
        message: 'A message',
      });

    let target = new WorkflowCard({
      author: { name: 'cardbot' },
      componentName: 'dummy-tall',
    });
    target.isComplete = true;

    workflow.milestones = [
      new Milestone({
        title: 'First milestone',
        postables: [message(), target],
        completedDetail: 'You are number one!',
      }),
    ];

    this.set('workflow', workflow);
    workflow.attachWorkflow();

    await render(hbs`
      <WorkflowThread @workflow={{this.workflow}} />
    `);

    // FIXME awk to wait for this to not exist and then assert that it doesn’t, probably because of autoscroll…?
    await waitUntil(() => {
      return find('[data-test-older]') === null;
    });

    assert.dom('[data-test-older]').doesNotExist();

    // FIXME better way to address scroll container? There are two 🤔
    find('.boxel-thread__scroll-wrapper')?.scrollTo(0, 0);

    await waitUntil(() => {
      return find('[data-test-older]');
    });

    assert.dom('[data-test-older]').exists();
  });
});
