import { run } from '@ember/runloop';
import Service from '@ember/service';
import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Component | cardstack tools launcher', function(hooks) {
  setupRenderingTest(hooks);

  hooks.beforeEach(function() {
    this.owner.register('service:cardstack-session', Service.extend({
      init() {
        this._super(...arguments);
        this.set('session', { isAuthenticated: true });
      }
    }));
    this.owner.register('service:cardstack-tools', Service.extend({
      sessionService: this.owner.lookup('service:cardstack-session'),
      available: true,
      active: false,
      setActive(value) {
        this.set('active', value);
      }
    }));
    this.tools = this.owner.lookup('service:cardstack-tools');
  });

  test('it renders with default implementation', async function(assert) {
    await render(hbs`{{cardstack-tools-launcher}}`);
    assert.equal(this.$('svg').length, 1, "found svg icon");
    assert.equal(this.$('svg.active').length, 0, "not active");
  });

  test('it renders with custom implementation', async function(assert) {
    await render(hbs`
      {{#cardstack-tools-launcher as |launcher|}}
        <div class="outer {{if launcher.active 'active'}}">
          <button {{action launcher.setActive true}}>Open</button>
          <button {{action launcher.setActive false}}>Close</button>
          <button {{action launcher.toggleActive}}>Toggle</button>
        </div>
      {{/cardstack-tools-launcher}}
    `);
    assert.equal(this.$('.outer').length, 1, 'found provided element');
  });

  test('it does not render when tools are not available', async function(assert) {
    this.get('tools').set('available', false);
    await render(hbs`{{cardstack-tools-launcher}}`);
    assert.equal(this.$('svg').length, 0, "no icon");
  });

  test('clicking icon toggles tools', async function(assert) {
    await render(hbs`{{cardstack-tools-launcher}}`);
    run(() => {
      this.$('button').click();
    });
    assert.equal(this.$('button.active').length, 1, "found active button");
  });
});
