import { moduleForComponent, test } from 'ember-qunit';
import Ember from 'ember';
import hbs from 'htmlbars-inline-precompile';

moduleForComponent('cs-admin-launcher', 'Integration | Component | cs admin launcher', {
  integration: true
});

test('it renders', function(assert) {
  this.render(hbs`{{cs-admin-launcher}}`);
  assert.equal(this.$('svg').length, 1, 'found icon');
});


test('it opens menu', function(assert) {
  this.render(hbs`{{#toolbar-manager}}{{cs-admin-launcher}}{{/toolbar-manager}}`);
  Ember.run(() => {
    this.$('svg').click();
  });
  assert.equal(this.$('.cs-admin-menu').length, 1, 'found menu');
});
