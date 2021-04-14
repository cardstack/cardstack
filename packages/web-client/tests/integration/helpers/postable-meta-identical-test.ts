import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import { WorkflowMessage } from '@cardstack/web-client/models/workflow/workflow-message';

module('Integration | Helper | postable-meta-identical', function (hooks) {
  setupRenderingTest(hooks);

  const postA = new WorkflowMessage({
    author: { name: 'Frank' },
    message: 'Message 1',
  });
  postA.timestamp = new Date(2021, 5, 15, 9, 0, 0, 0);
  const postB = new WorkflowMessage({
    author: { name: 'Frank' },
    message: 'Message 2',
  });
  postB.timestamp = new Date(2021, 5, 15, 9, 0, 0, 0);
  const postC = new WorkflowMessage({
    author: { name: 'Joe' },
    message: 'Message 3',
  });
  postC.timestamp = new Date(2021, 5, 15, 9, 0, 0, 0);
  const postD = new WorkflowMessage({
    author: { name: 'Frank' },
    message: 'Message 4',
  });
  postD.timestamp = new Date(2021, 5, 16, 9, 0, 0, 0);

  test('identical', async function (assert) {
    this.set('postA', postA);
    this.set('postB', postB);
    await render(hbs`{{postable-meta-identical this.postA this.postB}}`);
    assert.equal(this.element.textContent?.trim(), 'true');
  });

  test('authors different', async function (assert) {
    this.set('postA', postA);
    this.set('postC', postC);
    await render(hbs`{{postable-meta-identical this.postA this.postC}}`);
    assert.equal(this.element.textContent?.trim(), 'false');
  });

  test('times different', async function (assert) {
    this.set('postA', postA);
    this.set('postD', postD);
    await render(hbs`{{postable-meta-identical this.postA this.postD}}`);
    assert.equal(this.element.textContent?.trim(), 'false');
  });

  test('one is missing', async function (assert) {
    this.set('postA', postA);
    this.set('postB', null);
    await render(hbs`{{postable-meta-identical this.postA this.postB}}`);
    assert.equal(this.element.textContent?.trim(), 'false');
  });
});
