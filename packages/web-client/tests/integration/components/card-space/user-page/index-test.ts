import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, click } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import { ICardSpaceUserData } from '@cardstack/web-client/services/card-space-user-data';
import Service from '@ember/service';
import {
  createDepotSafe,
  createSafeToken,
} from '@cardstack/web-client/utils/test-factories';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';

const layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';
class MockCardSpaceUserData extends Service implements ICardSpaceUserData {
  currentUserData = {
    id: 'id',
    url: '2acmichael.card.space',
    profileName: 'profileName',
    profileDescription: 'profileDescription',
    profileCategory: 'profileCategory',
    profileButtonText: 'profileButtonText',
    profileImageUrl: '',
    profileCoverImageUrl: '',
    bioTitle: 'bioTitle',
    bioDescription: 'bioDescription',
    links: [],
    donationTitle: 'donationTitle',
    donationDescription: 'donationDescription',
    donationSuggestionAmount1: 100,
    donationSuggestionAmount2: 200,
    donationSuggestionAmount3: 300,
    donationSuggestionAmount4: 400,
    ownerAddress: layer2AccountAddress,
    merchantId: '2acmichael',
  };
}

module.only('Integration | Component | user-page', function (hooks) {
  setupRenderingTest(hooks);

  hooks.beforeEach(function () {
    this.owner.register('service:card-space-user-data', MockCardSpaceUserData);
  });

  test('it renders a Card Space user page for a non-owner', async function (assert) {
    await render(hbs`
      <CardSpace::UserPage/>
    `);

    assert.dom('[data-test-card-space-toggle-view-button]').doesNotExist();
    assert
      .dom('[data-test-card-space-floating-authenticate-button]')
      .doesNotExist();
    assert.dom('[data-test-card-space-card-container]').exists({ count: 4 });
    assert.dom('[data-test-card-space-layout-card-container]').exists();
    assert
      .dom('[data-test-card-space-card-container][data-test-editable]')
      .doesNotExist();
    assert
      .dom('[data-test-card-space-layout-card-container][data-test-editable]')
      .doesNotExist();
  });

  test('it contains an element with id card-space-image-editor', async function (assert) {
    await render(hbs`
      <CardSpace::UserPage/>
    `);
    assert.dom('#card-space-user-page-image-editor').exists({ count: 1 });
  });

  module('viewing as theowner', function () {
    test('it allows toggling a Card Space user page to edit mode when viewed as the authenticated owner', async function (assert) {
      window.TEST__AUTH_TOKEN = 'abc123--def456--ghi789';

      let layer2Service = this.owner.lookup('service:layer2-network')
        .strategy as Layer2TestWeb3Strategy;
      layer2Service.test__simulateRemoteAccountSafes(layer2AccountAddress, [
        createDepotSafe({
          owners: [layer2AccountAddress],
          tokens: [createSafeToken('DAI.CPXD', '0')],
        }),
      ]);
      await layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);

      await render(hbs`
        <CardSpace::UserPage/>
      `);

      assert.dom('[data-test-card-space-card-container]').exists({ count: 4 });
      assert.dom('[data-test-card-space-layout-card-container]').exists();
      assert
        .dom('[data-test-card-space-card-container][data-test-editable]')
        .doesNotExist();
      assert
        .dom('[data-test-card-space-layout-card-container][data-test-editable]')
        .doesNotExist();
      assert
        .dom('[data-test-card-space-floating-authenticate-button]')
        .doesNotExist();
      assert
        .dom('[data-test-card-space-toggle-view-button]')
        .containsText('Enter Edit Mode');

      await click('[data-test-card-space-toggle-view-button]');

      assert
        .dom('[data-test-card-space-toggle-view-button]')
        .containsText('Enter Preview Mode');
      assert
        .dom('[data-test-card-space-card-container][data-test-editable]')
        .exists({ count: 4 });
      assert
        .dom('[data-test-card-space-layout-card-container][data-test-editable]')
        .exists();
      assert
        .dom('[data-test-card-space-card-container]:not([data-test-editable])')
        .doesNotExist();
      assert
        .dom(
          '[data-test-card-space-layout-card-container]:not([data-test-editable])'
        )
        .doesNotExist();
      window.TEST__AUTH_TOKEN = undefined;
    });

    test('it lets the user know to authenticate with hub to enable editing if they own the space and are not authenticated', async function (assert) {
      window.TEST__AUTH_TOKEN = undefined;

      let layer2Service = this.owner.lookup('service:layer2-network')
        .strategy as Layer2TestWeb3Strategy;
      layer2Service.test__simulateRemoteAccountSafes(layer2AccountAddress, [
        createDepotSafe({
          owners: [layer2AccountAddress],
          tokens: [createSafeToken('DAI.CPXD', '0')],
        }),
      ]);
      await layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);

      await render(hbs`
        <CardSpace::UserPage/>
      `);

      assert.dom('[data-test-card-space-toggle-view-button]').doesNotExist();
      assert
        .dom('[data-test-card-space-floating-authenticate-button]')
        .containsText('Authenticate with hub to enable editing');
      // TODO: assert that the button opens up the hub auth
    });
  });
});
