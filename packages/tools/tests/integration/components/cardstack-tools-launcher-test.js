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
    assert.dom('[data-test-cardstack-tools-launcher-button]').exists('found button');
    assert.dom('[data-test-cardstack-tools-launcher-icon="false"]').exists('button is not active');
  });

  test('it renders with custom implementation', async function(assert) {
    await render(hbs`git
      {{#cardstack-tools-launcher as |launcher|}}
        <div class="outer {{if launcher.active 'active'}}" data-test-cardstack-tools-launcher-block>
          <button {{action launcher.setActive true}}>Open</button>
          <button {{action launcher.setActive false}}>Close</button>
          <button {{action launcher.toggleActive}}>Toggle</button>
        </div>
      {{/cardstack-tools-launcher}}
    `);
    assert.dom('[data-test-cardstack-tools-launcher-block]').exists('found provided element');
  });

  test('it does not render when tools are not available', async function(assert) {
    await render(hbs`{{cardstack-tools-edges}}`);
    this.get('tools').set('available', false);

    assert.dom('[data-test-cardstack-tools-launcher-icon="false"]').doesNotExist('no icon');
    assert.dom('[data-test-cardstack-tools-launcher-icon="true"]').doesNotExist('no icon');
  });

  test('clicking icon toggles tools', async function(assert) {
    await render(hbs`{{cardstack-tools-launcher}}`);
    run(() => {
      this.$('[data-test-cardstack-tools-launcher-button]').click();
    });
    assert.dom('[data-test-cardstack-tools-launcher-icon="true"]').exists('found active button');
  });
});
