import { run } from '@ember/runloop';
import Service from '@ember/service';
import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Component | cs branch control', function(hooks) {
  setupRenderingTest(hooks);

  hooks.beforeEach(function() {
    this.owner.register('service:cardstack-tools', Service.extend({
      branch: 'master',
      init() {
        this._super();
        this.branchSets = [];
      },
      setBranch(which) {
        this.branchSets.push(which);
        this.set('branch', which);
      }
    }));
    this.tools = this.owner.lookup('service:cardstack-tools');
  });

  test('it renders in live mode', async function(assert) {
    await render(hbs`{{cs-branch-control}}`);
    assert.equal(this.$('button.active').text().trim(), 'Live');
  });

  test('it renders in preview mode', async function(assert) {
    this.get('tools').set('branch', 'b');
    await render(hbs`{{cs-branch-control}}`);
    assert.equal(this.$('button.active').text().trim(), 'Preview');
  });

  test('it enters preview', async function(assert) {
    await render(hbs`{{cs-branch-control}}`);
    run(() => {
      this.$('button:contains(Preview)').click();
    });
    assert.deepEqual(this.get('tools.branchSets'), ['draft']);
    assert.equal(this.$('button.active').text().trim(), 'Preview');
  });

  test('it enters live', async function(assert) {
    this.get('tools').set('branch', 'b');
    await render(hbs`{{cs-branch-control}}`);
    run(() => {
      this.$('button:contains(Live)').click();
    });
    assert.deepEqual(this.get('tools.branchSets'), ['master']);
    assert.equal(this.$('button.active').text().trim(), 'Live');
  });
});
