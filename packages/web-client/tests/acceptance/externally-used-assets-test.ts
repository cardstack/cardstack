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
  // eslint-disable-next-line qunit/require-expect
  test('Each of the assets provided exists', async function (assert) {
    const container = document.querySelector((config as any).APP.rootElement)!;
    container.style.overflow = 'visible';

    const pendingImageResults = [];

    // loop over and add image elements to DOM
    // and also add the image results to an array
    // in the same order as the asset paths so that we can pair them by index
    for (let assetUrl of EXTERNALLY_USED_ASSET_PATHS) {
      const image = new Image();
      let pendingImageResult = new Promise((resolve) => {
        image.onload = () => resolve(true);
        image.onerror = () => resolve(false);
      });
      image.src = assetUrl;

      pendingImageResults.push(pendingImageResult);

      container.appendChild(image);
    }

    let imageResults = await Promise.all(pendingImageResults);

    for (let index = 0; index < imageResults.length; index++) {
      assert.ok(
        imageResults[index],
        `"${EXTERNALLY_USED_ASSET_PATHS[index]}" can be loaded`
      );
    }

    await percySnapshot('Externally used assets');
  });
});
