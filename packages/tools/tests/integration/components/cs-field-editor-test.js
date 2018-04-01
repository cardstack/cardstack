import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import DS from 'ember-data';
import Ember from 'ember';

module('Integration | Component | cs field editor', function(hooks) {
  setupRenderingTest(hooks);

  hooks.beforeEach(function() {
    this.owner.register('model:example', DS.Model.extend({
      title: DS.attr('string'),
      score: DS.attr({ fieldType: 'custom-score' }),
      echo: DS.attr({ fieldType: 'echo' })
    }));
    this.owner.register('template:components/field-editors/string-editor', hbs`
      This is the string editor
    `);
    this.owner.register('template:components/field-editors/custom-score-editor', hbs`
      This is the custom score editor
    `);
    this.owner.register('template:components/field-editors/echo-editor', hbs`
      <div class="echo {{if enabled 'enabled'}}">{{get content field}}</div>
    `);
    this.store = this.owner.lookup('service:store');
  });

  test('it renders correct field editor based on attr transform type', async function(assert) {
    Ember.run(() => {
      this.set('model', this.get('store').createRecord('example'));
    });
    await render(hbs`{{cs-field-editor content=model field="title" }}`);
    assert.equal(this.$().text().trim(), 'This is the string editor');
  });

  test('it renders correct field editor based on custom fieldType annotation', async function(assert) {
    Ember.run(() => {
      this.set('model', this.get('store').createRecord('example'));
    });
    await render(hbs`{{cs-field-editor content=model field="score" }}`);
    assert.equal(this.$().text().trim(), 'This is the custom score editor');
  });

  test('it passes content and field name to editor', async function(assert) {
    Ember.run(() => {
      this.set('model', this.get('store').createRecord('example', { echo: 'woohoo' }));
    });
    await render(hbs`{{cs-field-editor content=model field="echo" }}`);
    assert.equal(this.$('.echo').text().trim(), 'woohoo');
  });

  test('it passes enabled state to editor', async function(assert) {
    Ember.run(() => {
      this.set('model', this.get('store').createRecord('example', { echo: 'woohoo' }));
    });
    this.set('enabled', true);
    await render(hbs`{{cs-field-editor content=model field="echo" enabled=enabled}}`);
    assert.equal(this.$('.echo.enabled').length, 1);
    this.set('enabled', false);
    assert.equal(this.$('.echo.enabled').length, 0);
  });
});
