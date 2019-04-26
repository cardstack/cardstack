import Service from '@ember/service';
import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, click } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Component | cs tools launcher', function(hooks) {
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
      requestedEditing: false,
      setActive(value) {
        this.set('active', value);
      },
      setEditing(value) {
        this.set('requestedEditing', value);
      }
    }));
    this.tools = this.owner.lookup('service:cardstack-tools');
  });

  test('it renders with default implementation', async function(assert) {
    await render(hbs`{{cs-tools-launcher}}`);
    assert.dom('[data-test-cardstack-tools-launcher]').exists();
    assert.dom('[data-test-cardstack-tools-launcher-icon="false"]').exists();
  });

  test('it renders with custom implementation', async function(assert) {
    await render(hbs`
      {{#cs-tools-launcher as |launcher|}}
        <div class="outer {{if launcher.active 'active'}}" data-test-cardstack-tools-launcher-block>
          <button {{action launcher.setActive true}}>Open</button>
          <button {{action launcher.setActive false}}>Close</button>
          <button {{action launcher.toggleActive}}>Toggle</button>
        </div>
      {{/cs-tools-launcher}}
    `);
    assert.dom('[data-test-cardstack-tools-launcher-block] button').exists();
  });

  test('it does not render when tools are not available', async function(assert) {
    await render(hbs`{{cs-tools}}`);
    this.get('tools').set('available', false);
    assert.dom('[data-test-cardstack-tools-launcher]').doesNotExist();
  });

  test('clicking icon toggles tools', async function(assert) {
    await render(hbs`{{cs-tools-launcher}}`);
    await click('[data-test-cardstack-tools-launcher]');
    assert.dom('[data-test-cardstack-tools-launcher-icon="true"]').exists();

    await click('[data-test-cardstack-tools-launcher]');
    assert.dom('[data-test-cardstack-tools-launcher-icon="false"]').exists();
  });
});
