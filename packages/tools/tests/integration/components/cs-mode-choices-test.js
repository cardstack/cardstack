import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import Ember from 'ember';

module('Integration | Component | cs mode choices', function(hooks) {
  setupRenderingTest(hooks);

  hooks.beforeEach(function() {
    this.owner.register('service:cardstack-tools', Ember.Service.extend({

      // This is the basic protocol required by cs-mode-choices: a
      // property to control, choices, and a setter function:
      favoriteColor: 'blue',
      favoriteColorChoices: Ember.computed(function() {
        return [
          { id: 'blue', description: 'Blue' },
          { id: 'red', description: 'Red' }
        ];
      }),
      setFavoriteColor(color) {
        this.set('favoriteColor', color);
      }

    }));
    this.tools = this.owner.lookup('service:cardstack-tools');
  });

  test('it renders', async function(assert) {
    await render(hbs`
      {{#cs-mode-choices for="favoriteColor" as |choice|}}
        <section>
          {{cs-mode-button mode=choice}}
        </section>
      {{/cs-mode-choices}}
    `);
    assert.equal(this.$('section').length, 2);
    assert.equal(this.$('.cs-mode-button.active').length, 1);
  });

  test('it can update value', async function(assert) {
    await render(hbs`
      {{#cs-mode-choices for="favoriteColor" as |choice|}}
        <section>
          {{cs-mode-button mode=choice}}
        </section>
      {{/cs-mode-choices}}
    `);
    Ember.run(() => this.$('.cs-mode-button:contains(Red)').click());
    assert.equal(this.get('tools.favoriteColor'), 'red');
  });
});
