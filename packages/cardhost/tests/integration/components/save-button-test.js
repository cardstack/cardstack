import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, click } from '@ember/test-helpers';
import Service from '@ember/service';

import hbs from 'htmlbars-inline-precompile';

module('Integration | Component | save-button', function(hooks) {
  setupRenderingTest(hooks);

  test('it renders', async function(assert) {
    await render(hbs`<SaveButton />`);

    assert.equal(this.element.textContent.trim(), 'Saved');
  });

  test('can change click action', async function(assert) {
    assert.expect(1);

    this.owner.register(
      'service:cardstack-session',
      Service.extend({
        isAuthenticated: true,
      })
    );
    this.set('card', {
      isDirty: true,
    });
    this.set('clickAction', () => {
      assert.ok(true);
    });

    await render(hbs`<SaveButton @card={{this.card}} @clickAction={{this.clickAction}}/>`);

    await click('[data-test-card-save-btn]');
  });

  test('autosaves when card is dirty', async function(assert) {
    assert.expect(1);

    this.owner.register(
      'service:cardstack-session',
      Service.extend({
        isAuthenticated: true,
      })
    );
    this.set('card', {
      isDirty: false,
    });
    this.set('clickAction', () => {
      assert.ok(true);
    });

    await render(hbs`<SaveButton @card={{this.card}} @clickAction={{this.clickAction}} @autosaveDisabled={{false}}/>`);

    this.set('card', {
      isDirty: true,
    });

    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  test('can disable autosave', async function(assert) {
    assert.expect(0);

    this.owner.register(
      'service:cardstack-session',
      Service.extend({
        isAuthenticated: true,
      })
    );
    this.set('card', {
      isDirty: false,
    });
    this.set('clickAction', () => {
      assert.ok(true);
    });

    await render(hbs`<SaveButton @card={{this.card}} @clickAction={{this.clickAction}} @autosaveDisabled={{true}}/>`);

    this.set('card', {
      isDirty: true,
    });

    await new Promise(resolve => setTimeout(resolve, 1000));
  });
});
