import { run } from '@ember/runloop';
import EmberObject from '@ember/object';
import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import DS from 'ember-data';

let model;

module('Integration | Component | cs version control', function(hooks) {
  setupRenderingTest(hooks);

  hooks.beforeEach(function() {
    // We need a valid model here because the component will go
    // looking for its metadata, and ember-resource-metadata works
    // through ember-data's identity map.
    this.owner.register('model:thing', DS.Model.extend());
    model = EmberObject.create({
      id: 1,
      type: 'thing'
    });
    this.set('model', model);
    this.meta = this.owner.lookup('service:resource-metadata');
    this.get('meta').write(model, { branch: 'master' });
    this.owner.register('config:enviroment', {
      cardstack: { defaultBranch: 'master' }
    });
  });

  test('render with saved content', async function(assert) {
    model.set('hasDirtyFields', false);
    model.set('isNew', false);
    await render(hbs`{{cs-version-control model=model enabled=true}}`);
    assert.equal(this.$('.cs-version-control-footer button[disabled]').text().trim(), 'Update');
  });

  test('render with dirty content', async function(assert) {
    model.set('hasDirtyFields', true);
    model.set('isNew', false);
    await render(hbs`{{cs-version-control model=model enabled=true}}`);
    assert.equal(this.$('.cs-version-control-footer button[disabled]').length, 0, 'no disabled button');
    assert.equal(this.$('.cs-version-control-footer button').text().trim(), 'Update');
  });

  test('clicking update on dirty model triggers save', async function(assert) {
    assert.expect(1);
    model.set('save', function() {
      assert.ok(true);
    });
    model.set('hasDirtyFields', true);
    model.set('isNew', false);
    await render(hbs`{{cs-version-control model=model enabled=true}}`);
    run(() => {
      this.$('.cs-version-control-footer button').click();
    });
  });

  test('clicking update on clean model does nothing', async function(assert) {
    assert.expect(0);
    model.set('save', function() {
      throw new Error("should not happen");
    });
    model.set('hasDirtyFields', false);
    model.set('isNew', false);
    await render(hbs`{{cs-version-control model=model enabled=true}}`);
    run(() => {
      this.$('.cs-version-control-footer button').click();
    });
  });
});
