import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { click, render, waitFor } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import config from '@cardstack/ssr-web/config/environment';
import Service from '@ember/service';
import { tracked } from '@glimmer/tracking';
import sinon from 'sinon';

const universalLinkForWC = (walletConnectUri: string) =>
  'https://' + config.universalLinkDomain + '/wc?uri=' + walletConnectUri;

class StubLayerTwoNetwork extends Service {
  @tracked isInitializing = false;
  @tracked isConnected = false;
  @tracked walletConnectUri = '';
}

class StubHubAuthentication extends Service {
  @tracked isInitializing = false;
  @tracked isAuthenticated = false;
  async ensureAuthenticated() {
    return;
  }
}

class StubUA extends Service {
  isIOS() {
    return false;
  }

  isAndroid() {
    return false;
  }
}

const _STEP_WITH_NAME = (stepName: string) =>
  `[data-test-auth-step="${stepName}"]`;
const HEADER = '[data-test-auth-step-header]';
const LOADING_INDICATOR = '[data-test-auth-loading-indicator]';
const WALLET_CONNECT_QR = '[data-test-boxel-styled-qr-code]';
const WALLET_CONNECT_LINK = '[data-test-auth-connect-link]';
const HUB_AUTH_BUTTON = '[data-test-hub-auth-button]';
const HUB_AUTH_ERROR_MESSAGE = '[data-test-hub-auth-error]';

module('Integration | Component | auth', function (hooks) {
  setupRenderingTest(hooks);
  let hubAuthenticationService: StubHubAuthentication;
  let layer2NetworkService: StubLayerTwoNetwork;
  let uaService: StubUA;

  hooks.beforeEach(function () {
    this.owner.register('service:hub-authentication', StubHubAuthentication);
    this.owner.register('service:layer2-network', StubLayerTwoNetwork);
    this.owner.register('service:ua', StubUA);
    hubAuthenticationService = this.owner.lookup('service:hub-authentication');
    layer2NetworkService = this.owner.lookup('service:layer2-network');
    uaService = this.owner.lookup('service:ua');
  });

  test('it can show a LOADING state when layer 2 is initializing', async function (assert) {
    layer2NetworkService.isInitializing = true;

    await render(hbs`<Auth/>`);

    assert.dom(_STEP_WITH_NAME('LOADING')).exists();
    assert.dom(HEADER).containsText('Checking your authentication status');
    assert.dom(LOADING_INDICATOR).exists();
  });

  test('it can show a LOADING state when hub auth is initializing', async function (assert) {
    hubAuthenticationService.isInitializing = true;

    await render(hbs`<Auth/>`);

    assert.dom(_STEP_WITH_NAME('LOADING')).exists();
    assert.dom(HEADER).containsText('Checking your authentication status');
    assert.dom(LOADING_INDICATOR).exists();
  });

  test('it can show the WALLET_CONNECT state', async function (assert) {
    hubAuthenticationService.isInitializing = true;
    layer2NetworkService.isConnected = false;
    hubAuthenticationService.isAuthenticated = false;
    await render(hbs`<Auth/>`);

    assert.dom(_STEP_WITH_NAME('LOADING')).exists();

    hubAuthenticationService.isInitializing = false;

    await waitFor(_STEP_WITH_NAME('WALLET_CONNECT'));

    assert.dom(HEADER).containsText('Connect your wallet');
    assert
      .dom(WALLET_CONNECT_QR)
      .hasAttribute(
        'data-test-boxel-styled-qr-code',
        layer2NetworkService.walletConnectUri
      );
  });

  test('it can show the WALLET_CONNECT state with a link, in iOS', async function (assert) {
    sinon.stub(uaService, 'isIOS').callsFake(() => true);

    hubAuthenticationService.isInitializing = true;
    layer2NetworkService.isConnected = false;
    hubAuthenticationService.isAuthenticated = false;

    await render(hbs`<Auth/>`);

    assert.dom(_STEP_WITH_NAME('LOADING')).exists();

    hubAuthenticationService.isInitializing = false;

    await waitFor(_STEP_WITH_NAME('WALLET_CONNECT'));

    assert.dom(HEADER).containsText('Connect your wallet');
    assert
      .dom(WALLET_CONNECT_LINK)
      .hasAttribute(
        'href',
        universalLinkForWC(layer2NetworkService.walletConnectUri)
      );
  });

  test('it can show the WALLET_CONNECT state with a link, in Android', async function (assert) {
    sinon.stub(uaService, 'isAndroid').callsFake(() => true);

    hubAuthenticationService.isInitializing = true;
    layer2NetworkService.isConnected = false;
    hubAuthenticationService.isAuthenticated = false;

    await render(hbs`<Auth/>`);

    assert.dom(_STEP_WITH_NAME('LOADING')).exists();

    hubAuthenticationService.isInitializing = false;

    await waitFor(_STEP_WITH_NAME('WALLET_CONNECT'));

    assert.dom(HEADER).containsText('Connect your wallet');
    assert
      .dom(WALLET_CONNECT_LINK)
      .hasAttribute(
        'href',
        universalLinkForWC(layer2NetworkService.walletConnectUri)
      );
  });

  test('it can show the HUB_AUTH state', async function (assert) {
    hubAuthenticationService.isInitializing = true;
    layer2NetworkService.isConnected = true;
    hubAuthenticationService.isAuthenticated = false;

    await render(hbs`<Auth/>`);

    assert.dom(_STEP_WITH_NAME('LOADING')).exists();

    hubAuthenticationService.isInitializing = false;

    await waitFor(_STEP_WITH_NAME('HUB_AUTH'));

    assert.dom(HEADER).containsText('Authenticate with hub');
    assert
      .dom(HUB_AUTH_BUTTON)
      .isEnabled()
      .containsText('Authenticate with Hub');
  });

  test('it can show the DONE state', async function (assert) {
    hubAuthenticationService.isInitializing = true;
    layer2NetworkService.isConnected = true;
    hubAuthenticationService.isAuthenticated = true;

    let completed = false;
    this.set('onComplete', () => (completed = true));

    await render(hbs`<Auth
      @onComplete={{this.onComplete}}
    />`);

    assert.dom(_STEP_WITH_NAME('LOADING')).exists();

    hubAuthenticationService.isInitializing = false;

    await waitFor(_STEP_WITH_NAME('DONE'));

    assert.dom(HEADER).containsText("You're authenticated!");
    assert.ok(completed);
  });

  test('it can move from the WALLET_CONNECT state to the HUB_AUTH state', async function (assert) {
    layer2NetworkService.isConnected = false;
    hubAuthenticationService.isAuthenticated = false;
    await render(hbs`<Auth/>`);

    assert.dom(_STEP_WITH_NAME('WALLET_CONNECT')).exists();

    layer2NetworkService.isConnected = true;

    await waitFor(_STEP_WITH_NAME('HUB_AUTH'));

    assert.dom(HEADER).containsText('Authenticate with hub');
  });

  test('it can move from the HUB_AUTH state to the DONE state', async function (assert) {
    layer2NetworkService.isConnected = true;
    hubAuthenticationService.isAuthenticated = false;

    await render(hbs`<Auth/>`);

    assert.dom(_STEP_WITH_NAME('HUB_AUTH')).exists();

    hubAuthenticationService.isAuthenticated = true;

    await waitFor(_STEP_WITH_NAME('DONE'));

    assert.dom(HEADER).containsText("You're authenticated!");
  });

  test('it can move from the HUB_AUTH state to the WALLET_CONNECT state (disconnect)', async function (assert) {
    layer2NetworkService.isConnected = true;
    hubAuthenticationService.isAuthenticated = false;

    await render(hbs`<Auth/>`);

    assert.dom(_STEP_WITH_NAME('HUB_AUTH')).exists();

    layer2NetworkService.isConnected = false;

    await waitFor(_STEP_WITH_NAME('WALLET_CONNECT'));

    assert.dom(HEADER).containsText('Connect your wallet');
  });

  test('it can trigger a hub auth request by clicking the authentication button', async function (assert) {
    layer2NetworkService.isConnected = true;
    hubAuthenticationService.isAuthenticated = false;
    let authenticateSpy = sinon.spy(
      hubAuthenticationService,
      'ensureAuthenticated'
    );

    await render(hbs`<Auth/>`);

    assert.dom(_STEP_WITH_NAME('HUB_AUTH')).exists();
    assert.ok(authenticateSpy.notCalled);

    await click(HUB_AUTH_BUTTON);

    assert.ok(authenticateSpy.calledOnce);
  });

  test('it can show an error message if the call to authenticate in the HUB_AUTH state fails', async function (assert) {
    layer2NetworkService.isConnected = true;
    hubAuthenticationService.isAuthenticated = false;
    sinon
      .stub(hubAuthenticationService, 'ensureAuthenticated')
      .throws('no way');

    await render(hbs`<Auth/>`);

    assert.dom(_STEP_WITH_NAME('HUB_AUTH')).exists();

    await click(HUB_AUTH_BUTTON);

    assert
      .dom(HUB_AUTH_ERROR_MESSAGE)
      .containsText('Authentication failed or was canceled.');
  });
  test('it resets a HUB_AUTH error when the WALLET_CONNECT state is shown', async function (assert) {
    layer2NetworkService.isConnected = true;
    hubAuthenticationService.isAuthenticated = false;
    sinon
      .stub(hubAuthenticationService, 'ensureAuthenticated')
      .throws('no way');

    await render(hbs`<Auth/>`);

    assert.dom(_STEP_WITH_NAME('HUB_AUTH')).exists();

    await click(HUB_AUTH_BUTTON);

    assert
      .dom(HUB_AUTH_ERROR_MESSAGE)
      .containsText('Authentication failed or was canceled.');

    layer2NetworkService.isConnected = false;

    await waitFor(_STEP_WITH_NAME('WALLET_CONNECT'));

    layer2NetworkService.isConnected = true;

    assert.dom(HUB_AUTH_ERROR_MESSAGE).doesNotExist();
  });
});
