import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import Ember from 'ember';

module('Integration | Component | cardstack-workflow-launcher', function(hooks) {
  setupRenderingTest(hooks);

  hooks.beforeEach(function() {
    this.actions = {};
    this.send = (actionName, ...args) => this.actions[actionName].apply(this, args);
  });

  hooks.beforeEach(function() {
    this.owner.register('service:cardstack-workflow', Ember.Service.extend({
      notificationCount: 3
    }));
    this.workflow = this.owner.lookup('service:cardstack-workflow');
  });

  test('it renders with default implementation', async function(assert) {
    this.actions.toggleOpen = () => { this.toggleProperty('isOpen'); };
    await render(hbs`{{cardstack-workflow-launcher onClick=(action 'toggleOpen')}}`);
    assert.equal(this.$(".cardstack-workflow-alert").hasClass("show-alert"), true);
  });
});
