import { moduleForComponent, test } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';

moduleForComponent('cardstack-user', 'Integration | Component | cardstack session', {
  integration: true
});

test('it renders', function(assert) {

  this.render(hbs`
    {{#cardstack-session as |session|}}
      template block text
    {{/cardstack-session}}
  `);

  assert.equal(this.$().text().trim(), 'template block text');
});
