import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import { run } from '@ember/runloop';
import hbs from 'htmlbars-inline-precompile';
import DS from 'ember-data';

module('Integration | Helper | cs-card-meta-caption', function(hooks) {
  setupRenderingTest(hooks);

  hooks.beforeEach(function() {
    this.store = this.owner.lookup('service:store');
    this.owner.register('model:post', DS.Model.extend({
      title: DS.attr()
    }));
    this.owner.register('model:comment', DS.Model.extend({
      body: DS.attr()
    }));
  });

  test('It returns a simple caption when the field model is the page model', async function(assert) {
    run(() => {
      this.set('post', this.get('store').createRecord('post'));
    });

    await render(hbs`{{cs-card-meta-caption post "Title" true}}`);

    assert.equal(this.element.textContent.trim(), 'Title');
  });

  test('It returns a caption that identifies the field model', async function(assert) {
    run(() => {
      this.set('comment', this.get('store').createRecord('comment', { id: 1 }));
    });

    await render(hbs`{{cs-card-meta-caption comment "Body" false}}`);

    assert.equal(this.element.textContent.trim(), 'Comment #1: Body');
  });
});
