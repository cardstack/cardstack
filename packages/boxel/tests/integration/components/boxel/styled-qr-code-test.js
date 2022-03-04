import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, waitFor } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

const QR = '[data-test-boxel-styled-qr-code]';
const QR_LOADING_INDICATOR =
  '[data-test-boxel-styled-qr-code-loading-indicator]';

const link =
  'https://pay.cardstack.com/merchat-asdnsadkasd?id=0x1238urfds&amount=73298587423545';

module('Integration | Component | styled-qr-code', function (hooks) {
  setupRenderingTest(hooks);

  test('it can render a visual loading state and moves out of it after', async function (assert) {
    await render(hbs`
      <Boxel::StyledQrCode @data={{this.data}} />
    `);

    assert.dom(`${QR} canvas`).doesNotExist();
    assert.dom(QR_LOADING_INDICATOR).isVisible();

    this.setProperties({
      data: link,
    });

    await waitFor(`${QR} canvas`, { timeout: 1000, count: 1 });

    assert.dom(QR_LOADING_INDICATOR).doesNotExist();
  });
});
