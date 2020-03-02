import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Component | maybe-animate', function(hooks) {
  setupRenderingTest(hooks);

  test('it renders', async function(assert) {
    await render(hbs`<MaybeAnimate><h1>Hello</h1></MaybeAnimate>`);
    assert.dom('h1').hasText('Hello');
  });

  test('it renders with component', async function(assert) {
    this.set('model', { id: 'card-1', isSelected: true });
    this.transition = () => {};

    await render(hbs`
      <MaybeAnimate
        @mode="edit"
        @animationMode="edit"
        @component="animated-value"
        @content={{this.model}}
        @watch={{this.model.isSelected}}
        @use={{this.transition}}
        @duration=500
      >
        <h1>{{this.model.id}}</h1>
      </MaybeAnimate>`);
    assert.dom('h1').hasText(`${this.model.id}`);
  });

  test('it renders list items', async function(assert) {
    this.set('fields', ['card1', 'card2', 'card3']);
    await render(hbs`
    <ul>
      <MaybeAnimate
        @mode="edit"
        @animationMode="view"
        @component="animated-each"
        @content={{this.fields}}
      as |field|>
        <li>{{field}}</li>
      </MaybeAnimate>
    </ul>`);
    assert.dom('ul').hasText('card1 card2 card3');
  });

  test('it renders list items with component', async function(assert) {
    this.set('model', {
      fields: [
        { id: 1, title: 'card1' },
        { id: 2, title: 'card2' },
        { id: 3, title: 'card3' },
      ],
    });
    this.transition = () => {};

    await render(hbs`
    <ul>
      <MaybeAnimate
        @mode="view"
        @animationMode="view"
        @component="animated-each"
        @content={{this.model.fields}}
        @key="id"
        @use={{this.transition}}
        @duration=1000
      as |field|>
        <li>{{field.title}}</li>
      </MaybeAnimate>
    </ul>`);
    assert.dom('ul').hasText('card1 card2 card3');
  });
});
