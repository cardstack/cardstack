import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import { WorkflowMessage } from '@cardstack/ssr-web/models/workflow';

module('Integration | Helper | postable-meta-identical', function (hooks) {
  setupRenderingTest(hooks);

  const newPost = (name: string, timestamp: Date) => {
    const post = new WorkflowMessage({
      author: { name },
      message: 'Message at' + timestamp.toString(),
    });
    post.timestamp = timestamp;
    return post;
  };
  const firstPostTime = new Date(2021, 5, 15, 9, 0, 0, 0);

  /*
    Since we aren't specifying order of arguments via named arguments, check
    to make sure that time comparisons and falsey comparisons
    work both ways, just in case.
  */
  test('same author and both posts within a minute', async function (assert) {
    const earlierPost = newPost('Frank', firstPostTime);
    const laterPost = newPost(
      'Frank',
      new Date(firstPostTime.getTime() + 59 * 1000)
    );
    this.set('postA', earlierPost);
    this.set('postB', laterPost);
    await render(hbs`{{postable-meta-identical this.postA this.postB}}`);

    assert.equal(this.element.textContent?.trim(), 'true');

    this.set('postA', laterPost);
    this.set('postB', earlierPost);
    assert.equal(this.element.textContent?.trim(), 'true');
  });

  test('authors different', async function (assert) {
    this.set('postA', newPost('Frank', firstPostTime));
    this.set('postB', newPost('Not Frank', firstPostTime));
    await render(hbs`{{postable-meta-identical this.postA this.postB}}`);
    assert.equal(this.element.textContent?.trim(), 'false');
  });

  test('times different by more than a minute', async function (assert) {
    const earlierPost = newPost('Frank', firstPostTime);
    const laterPost = newPost(
      'Frank',
      new Date(firstPostTime.getTime() + 60 * 1000 + 1)
    );

    this.set('postA', earlierPost);
    this.set('postB', laterPost);
    await render(hbs`{{postable-meta-identical this.postA this.postB}}`);
    assert.equal(this.element.textContent?.trim(), 'false');

    this.set('postA', laterPost);
    this.set('postB', earlierPost);
    assert.equal(this.element.textContent?.trim(), 'false');
  });

  test('one is missing', async function (assert) {
    const post = newPost('Frank', firstPostTime);
    this.set('postA', post);
    this.set('postB', null);
    await render(hbs`{{postable-meta-identical this.postA this.postB}}`);
    assert.equal(this.element.textContent?.trim(), 'false');

    this.set('postA', null);
    this.set('postB', post);
    assert.equal(this.element.textContent?.trim(), 'false');
  });
});
