import { moduleForComponent, test } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';
import Ember from 'ember';

moduleForComponent('cardstack-workflow-launcher', 'Integration | Component | cardstack-workflow-launcher', {
  integration: true,
  beforeEach() {
    this.register('service:cardstack-workflow', Ember.Service.extend({
      notificationCount: 3
    }));
    this.inject.service('cardstack-workflow', { as: 'workflow' });
  }
});

test('it renders with default implementation', function(assert) {
  this.render(hbs`{{cardstack-workflow-launcher}}`);
  assert.equal(this.$().text().trim(), '3');
});
