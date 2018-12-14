import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Component | cs branch control', function(hooks) {
  setupRenderingTest(hooks);

  hooks.beforeEach(function() {
    this.data = this.owner.lookup('service:cardstack-data');
  });

  test('it renders and displays the current branch', async function(assert) {
    await render(hbs`{{cs-branch-control}}`);
    assert.dom('[data-test-branch-control]').exists()
    assert.dom('[data-test-branch-control] .ember-power-select-selected-item').hasText('master');
  });

  test('it displays all of the branches', async function(assert) {
    this.data.reopen({
      branches: async function() {
        return ['one', 'two', 'master', 'face']
      },
    });

    await render(hbs`{{cs-branch-control}}`);

    assert.equal(
      this.element.querySelector('[data-test-branch-control-branch-count]').getAttribute('data-test-branch-control-branch-count'),
      4
    )
  });
});
