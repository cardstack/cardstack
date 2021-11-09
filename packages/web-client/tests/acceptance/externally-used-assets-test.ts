import { module, test } from 'qunit';
import config from '@cardstack/web-client/config/environment';
import percySnapshot from '@percy/ember';

const EXTERNALLY_USED_ASSET_PATHS = [
  // prepaid card patterns used for prepaid card customizations
  '/images/prepaid-card-customizations/pattern-1.svg',
  '/images/prepaid-card-customizations/pattern-2.svg',
  '/images/prepaid-card-customizations/pattern-3.svg',
  '/images/prepaid-card-customizations/pattern-4.svg',
  // token logos used for honeyswap
  '/images/logos/tokens/card.cpxd.png',
  '/images/logos/tokens/dai.cpxd.png',
  // icons used for WalletConnect (we control this, see config.walletConnectIcons)
  '/images/icon-apple-256x256.png',
  '/images/icon-favicon-32x32.png',
];

module('Acceptance | externally used assets', function () {
  test('Each of the assets provided exists', async function (assert) {
    const container = document.querySelector((config as any).APP.rootElement)!;
    container.style.overflow = 'visible';

    for (let assetUrl of EXTERNALLY_USED_ASSET_PATHS) {
      const image = new Image();
      let p = new Promise((resolve) => {
        image.onload = () => resolve(true);
        image.onerror = () => resolve(false);
      });
      image.src = assetUrl;

      container.appendChild(image);

      assert.ok(await p, `"${assetUrl}" can be loaded`);
    }

    await percySnapshot('Externally used assets');
  });
});
