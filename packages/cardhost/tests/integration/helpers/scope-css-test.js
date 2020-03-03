import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

let scopedSingleCard = `.my-card--isolated .a {}
.my-card--isolated .b {}`;
let scopedMultipleCards = `.card1--embedded .a , .card2--embedded .a {}
.card1--embedded .b , .card2--embedded .b {}`;

module('Integration | Helper | scope-css', function(hooks) {
  setupRenderingTest(hooks);

  test('it renders for a single card', async function(assert) {
    this.set('card', { canonicalURL: 'my-card' });
    await render(hbs`{{scope-css ".a {}
.b {}" card "isolated"}}`);
    assert.equal(this.element.textContent.trim(), scopedSingleCard);
  });

  test('it renders for multiple cards', async function(assert) {
    this.set('cards', [{ canonicalURL: 'card1' }, { canonicalURL: 'card2' }]);
    await render(hbs`{{scope-css ".a {}
.b {}" cards "embedded"}}`);
    assert.equal(this.element.textContent.trim(), scopedMultipleCards);
  });
});
