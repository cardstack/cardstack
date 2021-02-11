import { module, skip } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';

module('Integration | card-service', function (hooks) {
  setupRenderingTest(hooks);

  skip('it provides a working isolated card', async function (assert) {
    // NEXT: setup mirage so you declare RawCards and mirage calls the card
    // compiler. Move existing stub data out of core/src/index.ts.
    let cardService = this.owner.lookup('service:card');

    // TODO: we're only using set to make typescript happy, can we fing a nicer
    // way?
    this.set(
      'cardComponent',
      await cardService.load({
        url: 'https://localhost/base/models/person-0',
        format: 'embedded',
      })
    );
    await render(hbs`<this.cardComponent />`);
    assert.equal(
      this.element.textContent?.trim(),
      'Arthur was born on March 29, 2016'
    );
  });
});
