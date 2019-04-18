import EmberObject from '@ember/object';
import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { timeout } from 'ember-concurrency';
import { render, click, waitFor } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import DS from 'ember-data';

module('Integration | Component | cs version control', function(hooks) {
  setupRenderingTest(hooks);

  hooks.beforeEach(function() {
    // We need a valid model here because the component will go
    // looking for its metadata, and ember-resource-metadata works
    // through ember-data's identity map.
    this.owner.register('model:thing', DS.Model.extend());
    // It's unfortunate we use a mock object for a full-fledged
    // cardstack Model instance. That makes it necessary to mock out
    // all the methods exercised from this component, like `relatedOwnedRecords`.
    // It's not obvious how to use such a Model or at least a DS.Model
    // as for example the `isNew` CP cannot be set, then
    let model = EmberObject.create({
      id: 1,
      type: 'thing',
      serialize() {
        return {
          id: '1',
          type: 'things',
          data: {
            attributes: {}
          }
        }
      },
      relatedOwnedRecords() {
        return [];
      },

    });
    this.set('model', model);
    this.meta = this.owner.lookup('service:resource-metadata');
    this.get('meta').write(model, {});
    this.owner.register('config:enviroment', {
      cardstack: { }
    });
    this.owner.lookup('router:main').setupRouter();
  });

  test('render with saved content', async function(assert) {
    this.model.set('hasDirtyFields', false);
    this.model.set('isNew', false);
    await render(hbs`{{cs-version-control model=model enabled=true}}`);
    assert.dom('[data-test-cs-version-control-button-save="true"]').hasText('Save');
    assert.dom('[data-test-cs-version-control-button-cancel="true"]').hasText('Cancel');
  });

  test('render with dirty content', async function(assert) {
    this.model.set('hasDirtyFields', true);
    this.model.set('isNew', false);
    await render(hbs`{{cs-version-control model=model enabled=true}}`);
    assert.dom('[data-test-cs-version-control-button-save="true"]').doesNotExist('no disabled button');
    assert.dom('[data-test-cs-version-control-button-save="false"]').hasText('Save');
  });

  test('clicking on cancel exits edit mode for new model', async function (assert) {
    this.tools = this.owner.lookup('service:cardstack-tools');
    this.tools.setEditing(true);
    this.model.set('isNew', true);
    await render(hbs`{{cs-version-control model=model enabled=true}}`);
    await click('[data-test-cs-version-control-button-cancel]');
    assert.equal(this.tools.get('editing'), false);
  });

  test('clicking on cancel exits edit mode for dirty model', async function (assert) {
    this.tools = this.owner.lookup('service:cardstack-tools');
    this.tools.setEditing(true);
    this.model.set('isNew', false);
    this.model.set('hasDirtyFields', true);
    await render(hbs`{{cs-version-control model=model enabled=true}}`);
    await click('[data-test-cs-version-control-button-cancel]');
    assert.equal(this.tools.get('editing'), false);
  });

  test('clicking cancel on dirty model resets changes', async function (assert) {
    assert.expect(1);
    this.model.set('cardstackRollback', function () {
      assert.ok(true);
    });
    this.model.set('hasDirtyFields', true);
    this.model.set('isNew', false);
    await render(hbs`{{cs-version-control model=model enabled=true}}`);
    await click('[data-test-cs-version-control-button-cancel]');
  });

  test('clicking update on dirty model triggers save', async function(assert) {
    assert.expect(1);
    this.model.set('save', function() {
      assert.ok(true);
    });
    this.model.set('hasDirtyFields', true);
    this.model.set('isNew', false);
    await render(hbs`{{cs-version-control model=model enabled=true}}`);
    await click('[data-test-cs-version-control-button-save="false"]');
  });

  test('clicking update shows loading spinner', async function(assert) {
    assert.expect(2);
    this.model.set('save', async () => await timeout(5));
    this.model.set('hasDirtyFields', true);
    this.model.set('isNew', false);
    assert.dom('[data-test-cs-version-control-loading]').doesNotExist('Does not display loading before click');
    await render(hbs`{{cs-version-control model=model enabled=true}}`);
    click('[data-test-cs-version-control-button-save="false"]');
    await waitFor('[data-test-cs-version-control-loading]');
    assert.dom('[data-test-cs-version-control-loading]').exists('Displays loading after click');
  });

  test('clicking update on clean model does nothing', async function(assert) {
    assert.expect(0);
    this.model.set('save', function() {
      throw new Error("should not happen");
    });
    this.model.set('hasDirtyFields', false);
    this.model.set('isNew', false);
    await render(hbs`{{cs-version-control model=model enabled=true}}`);
    await click('[data-test-cs-version-control-button-save="true"]');
  });

  test('clicking delete triggers deleteRecord', async function(assert) {
    assert.expect(1);
    this.model.set('destroyRecord', function() {
      assert.ok(true);
    });
    this.model.set('isNew', false);
    await render(hbs`{{cs-version-control model=model enabled=true}}`);
    await click('[data-test-cs-version-control-delete-button]');
  });

});
