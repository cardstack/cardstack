import Service from '@ember/service';
import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, find } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Component | cardstack-workflow-launcher', function(hooks) {
  setupRenderingTest(hooks);

  hooks.beforeEach(function() {
    this.actions = {};
    this.send = (actionName, ...args) => this.actions[actionName].apply(this, args);
  });

  hooks.beforeEach(function() {
    this.owner.register('service:cardstack-workflow', Service.extend({
      notificationCount: 3
    }));
    this.workflow = this.owner.lookup('service:cardstack-workflow');
  });

  test('it renders with default implementation', async function(assert) {
    this.actions.toggleOpen = () => { this.toggleProperty('isOpen'); };
    await render(hbs`{{cardstack-workflow-launcher onClick=(action 'toggleOpen')}}`);
    assert.equal(find(".cardstack-workflow-alert").classList.contains("show-alert"), true);
  });
});
