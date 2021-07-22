import { module, test } from 'qunit';
import { settled, visit } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';
import { setupMirage } from 'ember-cli-mirage/test-support';
import prepaidCardColorSchemes from '../../mirage/fixture-data/prepaid-card-color-schemes';
import prepaidCardPatterns from '../../mirage/fixture-data/prepaid-card-patterns';

module('Acceptance | card balances', function (hooks) {
  setupApplicationTest(hooks);
  setupMirage(hooks);

  hooks.beforeEach(function () {
    // TODO: fix typescript for mirage
    (this as any).server.db.loadData({
      prepaidCardColorSchemes,
      prepaidCardPatterns,
    });
  });

  test('Sidebar and cards are hidden when wallet is not connected', async function (assert) {
    await visit('/card-pay/balances');

    assert.dom('[data-test-balances-sidebar]').doesNotExist();
    assert.dom('[data-test-card-balances]').doesNotExist();
  });

  test('Sidebar shows and cards are listed when wallet is connected', async function (assert) {
    let layer2Service = this.owner.lookup('service:layer2-network')
      .strategy as Layer2TestWeb3Strategy;

    let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';
    layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);

    // FIXME the ID is based on the hardcoded DID in test-layer2
    this.server.create('prepaid-card-customization', {
      id: 'rcYScXTPjrxb8Sej8o95DR',
      issuerName: 'jortleby',
      prepaidCardColorScheme: this.server.schema.prepaidCardColorSchemes.first(),
      prepaidCardPattern: this.server.schema.prepaidCardPatterns.all()
        .models[4],
    });

    await visit('/card-pay/balances');

    assert.dom('[data-test-account-sidebar]').containsText('0x1826...6E44');

    assert
      .dom('[data-test-card-balances]')
      .containsText('§2324')
      .containsText('0x1234...abcd');

    await settled();

    assert.dom('[data-test-prepaid-card-issuer-name]').containsText('jortleby');
    assert
      .dom(
        `[data-test-prepaid-card-background="${prepaidCardColorSchemes[0].background}"][data-test-prepaid-card-pattern="${prepaidCardPatterns[4].patternUrl}"]`
      )
      .exists();
  });
});
