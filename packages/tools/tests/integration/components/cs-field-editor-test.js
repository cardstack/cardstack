import { moduleForComponent, test } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';
import DS from 'ember-data';
import Ember from 'ember';

moduleForComponent('cs-field-editor', 'Integration | Component | cs field editor', {
  integration: true,
  beforeEach() {
    this.register('model:example', DS.Model.extend({
      title: DS.attr('string'),
      score: DS.attr({ fieldType: 'custom-score' }),
      echo: DS.attr({ fieldType: 'echo' })
    }));
    this.register('template:components/field-editors/string-editor', hbs`
      This is the string editor
    `);
    this.register('template:components/field-editors/custom-score-editor', hbs`
      This is the custom score editor
    `);
    this.register('template:components/field-editors/echo-editor', hbs`
      <div class="echo {{if enabled 'enabled'}}">{{get content field}}</div>
    `);
    this.inject.service('store');
  }
});

test('it renders correct field editor based on attr transform type', function(assert) {
  Ember.run(() => {
    this.set('model', this.get('store').createRecord('example'));
  });
  this.render(hbs`{{cs-field-editor content=model field="title" }}`);
  assert.equal(this.$().text().trim(), 'This is the string editor');
});

test('it renders correct field editor based on custom fieldType annotation', function(assert) {
  Ember.run(() => {
    this.set('model', this.get('store').createRecord('example'));
  });
  this.render(hbs`{{cs-field-editor content=model field="score" }}`);
  assert.equal(this.$().text().trim(), 'This is the custom score editor');
});

test('it passes content and field name to editor', function(assert) {
  Ember.run(() => {
    this.set('model', this.get('store').createRecord('example', { echo: 'woohoo' }));
  });
  this.render(hbs`{{cs-field-editor content=model field="echo" }}`);
  assert.equal(this.$('.echo').text().trim(), 'woohoo');
});

test('it passes enabled state to editor', function(assert) {
  Ember.run(() => {
    this.set('model', this.get('store').createRecord('example', { echo: 'woohoo' }));
  });
  this.set('enabled', true);
  this.render(hbs`{{cs-field-editor content=model field="echo" enabled=enabled}}`);
  assert.equal(this.$('.echo.enabled').length, 1);
  this.set('enabled', false);
  assert.equal(this.$('.echo.enabled').length, 0);
});
