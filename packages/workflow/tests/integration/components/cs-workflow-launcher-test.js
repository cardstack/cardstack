import { moduleForComponent, test } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';
import Ember from 'ember';

moduleForComponent('cs-workflow-launcher', 'Integration | Component | cs-workflow-launcher', {
  integration: true,
  beforeEach() {
    this.register('service:cardstack-workflow', Ember.Service.extend({
      notificationCount: 3
    }));
    this.inject.service('cardstack-workflow', { as: 'workflow' });
  }
});

test('it renders with default implementation', function(assert) {
  this.render(hbs`{{cs-workflow-launcher}}`);
  assert.equal(this.$().text().trim(), '3');
});
