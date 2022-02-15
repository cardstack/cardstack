import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import {
  WorkflowCard,
  WorkflowMessage,
} from '@cardstack/ssr-web/models/workflow';

module('Integration | Helper | postable-meta-hidden', function (hooks) {
  setupRenderingTest(hooks);

  const newPost = (name: string, timestamp: Date) => {
    const post = new WorkflowMessage({
      author: { name },
      message: 'Message at' + timestamp.toString(),
    });
    post.timestamp = timestamp;
    return post;
  };
  const newCard = (name: string, componentName: string, timestamp: Date) => {
    const post = new WorkflowCard({
      author: { name },
      componentName,
    });
    post.timestamp = timestamp;
    return post;
  };
  const firstPostTime = new Date(2021, 5, 15, 9, 0, 0, 0);

  test('same author and within the same minute', async function (assert) {
    const post1 = newPost('Frank', firstPostTime);
    const post2 = newPost(
      'Frank',
      new Date(firstPostTime.getTime() + 20 * 1000)
    );
    const post3 = newCard(
      'Frank',
      'card',
      new Date(firstPostTime.getTime() + 50 * 1000)
    );
    const post4 = newCard(
      'Frank',
      'card',
      new Date(firstPostTime.getTime() + 52 * 1000)
    );
    const post5 = newPost(
      'Frank',
      new Date(firstPostTime.getTime() + 59 * 1000)
    );
    this.set('postA', post2); // earlier post
    this.set('postB', post1); // later post
    await render(hbs`{{postable-meta-hidden this.postA previous=this.postB}}`);

    assert.equal(this.element.textContent?.trim(), 'true');

    this.set('postA', post1);
    this.set('postB', post2);
    assert.equal(this.element.textContent?.trim(), 'true');

    this.set('postA', post3); // has card (later post)
    this.set('postB', post2);
    // when one has card and the other doesn't, the order matters
    assert.equal(this.element.textContent?.trim(), 'true');

    this.set('postA', post4); // has card
    this.set('postB', post3); // has card
    assert.equal(this.element.textContent?.trim(), 'true');

    this.set('postA', post5);
    this.set('postB', post4); // has card (earlier post)
    assert.equal(
      this.element.textContent?.trim(),
      'false',
      'display meta for message post if it is following a card post'
    );
  });

  test('authors different', async function (assert) {
    const post1 = newPost('Frank', firstPostTime);
    const post2 = newPost('Not Frank', firstPostTime);
    const post3 = newCard('Not Frank At All', 'card', firstPostTime);
    const post4 = newCard('Frankie', 'card', firstPostTime);

    this.set('postA', post1);
    this.set('postB', post2);
    await render(hbs`{{postable-meta-hidden this.postA previous=this.postB}}`);
    assert.equal(this.element.textContent?.trim(), 'false');

    this.set('postA', post1);
    this.set('postB', post3);
    await render(hbs`{{postable-meta-hidden this.postA previous=this.postB}}`);
    assert.equal(this.element.textContent?.trim(), 'false');

    this.set('postA', post2);
    this.set('postB', post3);
    await render(hbs`{{postable-meta-hidden this.postA previous=this.postB}}`);
    assert.equal(this.element.textContent?.trim(), 'false');

    this.set('postA', post3);
    this.set('postB', post2);
    await render(hbs`{{postable-meta-hidden this.postA previous=this.postB}}`);
    assert.equal(this.element.textContent?.trim(), 'false');

    this.set('postA', post4);
    this.set('postB', post3);
    await render(hbs`{{postable-meta-hidden this.postA previous=this.postB}}`);
    assert.equal(this.element.textContent?.trim(), 'false');
  });

  test('times different by more than a minute', async function (assert) {
    const earlierPost = newPost('Frank', firstPostTime);
    const laterPost = newPost(
      'Frank',
      new Date(firstPostTime.getTime() + 60 * 1000 + 1)
    );
    const latestPost = newCard(
      'Frank',
      'card',
      new Date(firstPostTime.getTime() + 2 * 60 * 1000 + 1)
    );
    const finalCardPost = newCard(
      'Frank',
      'card',
      new Date(firstPostTime.getTime() + 3 * 60 * 1000 + 1)
    );
    const finalPost = newPost(
      'Frank',
      new Date(firstPostTime.getTime() + 4 * 60 * 1000 + 1)
    );

    this.set('postA', earlierPost);
    this.set('postB', laterPost);
    await render(hbs`{{postable-meta-hidden this.postA previous=this.postB}}`);
    assert.equal(this.element.textContent?.trim(), 'false');

    this.set('postA', laterPost);
    this.set('postB', earlierPost);
    assert.equal(this.element.textContent?.trim(), 'false');

    this.set('postA', latestPost);
    this.set('postB', laterPost);
    assert.equal(this.element.textContent?.trim(), 'false');

    this.set('postA', finalCardPost);
    this.set('postB', latestPost);
    assert.equal(this.element.textContent?.trim(), 'false');

    this.set('postA', finalPost);
    this.set('postB', finalCardPost);
    assert.equal(this.element.textContent?.trim(), 'false');
  });

  test('one is missing', async function (assert) {
    const post = newPost('Frank', firstPostTime);
    const cardPost = newCard('Frank', 'card', firstPostTime);
    this.set('postA', post);
    this.set('postB', null);
    await render(hbs`{{postable-meta-hidden this.postA previous=this.postB}}`);
    assert.equal(this.element.textContent?.trim(), 'false');

    this.set('postA', null);
    this.set('postB', post);
    assert.equal(this.element.textContent?.trim(), 'false');

    this.set('postA', cardPost);
    this.set('postB', null);
    assert.equal(this.element.textContent?.trim(), 'false');

    this.set('postA', null);
    this.set('postB', cardPost);
    assert.equal(this.element.textContent?.trim(), 'false');
  });
});
