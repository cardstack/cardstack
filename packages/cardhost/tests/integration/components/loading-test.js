import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';

module('Integration | Component | loading', function(hooks) {
  setupRenderingTest(hooks);

  test('it renders', async function(assert) {
    await render(hbs`<Loading />`);
    assert.equal(this.element.textContent.trim(), 'Generating Card'); // default value

    this.owner.lookup('service:overlays').setOverlayState('loadingText', 'Something is loading');
    await render(hbs`<Loading />`);
    assert.equal(this.element.textContent.trim(), 'Something is loading');
  });
});
