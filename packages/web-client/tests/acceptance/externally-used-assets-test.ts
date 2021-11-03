import { module, test } from 'qunit';

const EXTERNALLY_USED_ASSET_PATHS = [
  '/images/prepaid-card-customizations/pattern-1.svg',
  '/images/prepaid-card-customizations/pattern-2.svg',
  '/images/prepaid-card-customizations/pattern-3.svg',
  '/images/prepaid-card-customizations/pattern-4.svg',
  '/images/logos/tokens/card.cpxd.png',
  '/images/logos/tokens/dai.cpxd.png',
];

module('Acceptance | externally used assets', function () {
  test('Each of the assets provided exists', async function (assert) {
    for (let assetUrl of EXTERNALLY_USED_ASSET_PATHS) {
      const response = await fetch(assetUrl);
      assert.ok(response.ok, `"${assetUrl}" exists`);
    }
  });
});
