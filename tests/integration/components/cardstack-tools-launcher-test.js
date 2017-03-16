import { moduleForComponent, test } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';
import Ember from 'ember';

moduleForComponent('cardstack-tools-launcher', 'Integration | Component | cardstack tools launcher', {
  integration: true,
  beforeEach() {
    this.register('service:cardstack-tools', Ember.Service.extend({
      available: true,
      active: false,
      setActive(value) {
        this.set('active', value);
      }
    }));
    this.inject.service('cardstack-tools', { as: 'tools' });
  }
});

test('it renders with default implementation', function(assert) {
  this.render(hbs`{{cardstack-tools-launcher}}`);
  assert.equal(this.$('svg').length, 1, "found svg icon");
  assert.equal(this.$('svg.active').length, 0, "not active");
});

test('it renders with custom implementation', function(assert) {
  this.render(hbs`
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

test('it does not render when tools are not available', function(assert) {
  this.get('tools').set('available', false);
  this.render(hbs`{{cardstack-tools-launcher}}`);
  assert.equal(this.$('svg').length, 0, "no icon");
});

test('clicking icon toggles tools', function(assert) {
  this.render(hbs`{{cardstack-tools-launcher}}`);
  Ember.run(() => {
    this.$('svg').click();
  });
  assert.equal(this.$('svg.active').length, 1, "found active icon");
});
