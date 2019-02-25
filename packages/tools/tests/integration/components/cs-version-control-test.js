import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { timeout } from 'ember-concurrency';
import { render, click, waitFor } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import Fixtures from '@cardstack/test-support/fixtures';
import testDataSetup from '../../helpers/test-data-setup';

module('Integration | Component | cs-version-control', function(hooks) {
  setupRenderingTest(hooks);

  let scenario = new Fixtures({
    create(factory) {
      testDataSetup(factory);
    }
  })

  scenario.setupTest(hooks);

  hooks.beforeEach(async function() {
    await this.owner.lookup('service:cardstack-codegen').refreshCode();
    this.store = this.owner.lookup('service:store');

    let model = await this.store.findRecord('location', 'nyc');
    this.set('model', model);
    this.meta = this.owner.lookup('service:resource-metadata');
    this.get('meta').write(model, { branch: 'master' });
    this.owner.register('config:enviroment', {
      cardstack: { defaultBranch: 'master' }
    });
    this.owner.lookup('router:main').setupRouter();
  });

  test('render with saved content', async function(assert) {
    this.model.set('hasDirtyFields', false);
    await render(hbs`{{cs-version-control model=model enabled=true}}`);
    assert.dom('[data-test-cs-version-control-button-save="true"]').hasText('Save');
  });

  test('render with dirty content', async function(assert) {
    this.model.set('hasDirtyFields', true);
    await render(hbs`{{cs-version-control model=model enabled=true}}`);
    assert.dom('[data-test-cs-version-control-button-save="true"]').doesNotExist('no disabled button');
    assert.dom('[data-test-cs-version-control-button-save="false"]').hasText('Save');
  });

  test('clicking on cancel exits edit mode', async function (assert) {
    this.tools = this.owner.lookup('service:cardstack-tools');
    this.tools.setEditing(true);
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
    await render(hbs`{{cs-version-control model=model enabled=true}}`);
    await click('[data-test-cs-version-control-button-cancel]');
  });

  test('clicking update on dirty model triggers save', async function(assert) {
    assert.expect(1);
    this.model.set('save', function() {
      assert.ok(true);
    });
    this.model.set('hasDirtyFields', true);
    await render(hbs`{{cs-version-control model=model enabled=true}}`);
    await click('[data-test-cs-version-control-button-save="false"]');
  });

  test('clicking update shows loading spinner', async function(assert) {
    assert.expect(2);
    this.model.set('save', async () => await timeout(5));
    this.model.set('hasDirtyFields', true);
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
    await render(hbs`{{cs-version-control model=model enabled=true}}`);
    await click('[data-test-cs-version-control-button-save="true"]');
  });

  test('clicking delete triggers deleteRecord', async function(assert) {
    assert.expect(1);
    this.model.set('destroyRecord', function() {
      assert.ok(true);
    });
    await render(hbs`{{cs-version-control model=model enabled=true}}`);
    await click('[data-test-cs-version-control-delete-button]');
  });

  test('"draft" status is displayed for new model', async function (assert) {
    this.set('model', this.store.createRecord('location', { city: 'Portland' }));
    await render(hbs`{{cs-version-control model=model enabled=true}}`);
    assert.dom('[data-test-cs-version-control-dropdown-option-status]').hasText('draft');
  });

  test('"published" status is displayed for clean model', async function (assert) {
    this.model.set('hasDirtyFields', false);
    await render(hbs`{{cs-version-control model=model enabled=true}}`);
    assert.dom('[data-test-cs-version-control-dropdown-option-status]').hasText('published');
  });

  test('"edited" status is displayed for dirty model', async function (assert) {
    this.model.set('hasDirtyFields', true);
    await render(hbs`{{cs-version-control model=model enabled=true}}`);
    assert.dom('[data-test-cs-version-control-dropdown-option-status]').hasText('edited');
  });
});
