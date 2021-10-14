import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';
import sinon from 'sinon';
import HubAuthentication from '@cardstack/web-client/services/hub-authentication';
import TestLayer2Web3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';
import { settled } from '@ember/test-helpers';

let HUB_AUTH_TOKEN = 'HUB_AUTH_TOKEN';
let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';
let layer2Service: TestLayer2Web3Strategy;
let hubAuthentication: HubAuthentication;

module('Unit | Service | HubAuthentication', function (hooks) {
  setupTest(hooks);

  hooks.beforeEach(async function () {
    // this is the condition for initializing with an authenticated state
    // assumption made that layer2Service.checkHubAuthenticationValid returns Promise<true>
    window.TEST__AUTH_TOKEN = HUB_AUTH_TOKEN;
    layer2Service = this.owner.lookup('service:layer2-network').strategy;
    await layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);
  });

  hooks.afterEach(async function () {
    delete window.TEST__AUTH_TOKEN;
  });

  // Test initialization
  test('it can initialize with an authenticated state', async function (assert) {
    hubAuthentication = this.owner.lookup('service:hub-authentication');
    await settled();

    assert.ok(
      hubAuthentication.authToken === HUB_AUTH_TOKEN &&
        hubAuthentication.isAuthenticated,
      'authenticated'
    );
  });

  test('it can initialize with a non-authenticated state when layer 2 is not connected', async function (assert) {
    await layer2Service.test__simulateAccountsChanged([]);

    assert.ok(!layer2Service.isConnected, 'Layer 2 is not connected');

    hubAuthentication = this.owner.lookup('service:hub-authentication');
    await settled();

    assert.ok(
      !hubAuthentication.authToken && !hubAuthentication.isAuthenticated,
      'not authenticated'
    );
  });

  test('it can initialize with a non-authenticated state when there is no initial auth token', async function (assert) {
    window.TEST__AUTH_TOKEN = undefined;
    hubAuthentication = this.owner.lookup('service:hub-authentication');
    await settled();

    assert.ok(
      !hubAuthentication.authToken && !hubAuthentication.isAuthenticated,
      'not authenticated'
    );
  });

  test('it can initialize with a non-authenticated state when the initial auth token is not valid', async function (assert) {
    sinon
      .stub(layer2Service, 'checkHubAuthenticationValid')
      .returns(Promise.resolve(false));
    hubAuthentication = this.owner.lookup('service:hub-authentication');
    await settled();

    assert.ok(
      !hubAuthentication.authToken && !hubAuthentication.isAuthenticated,
      'not authenticated'
    );
  });

  // test being able to clear auth token
  test('its state becomes non-authenticated when the auth token is cleared', async function (assert) {
    hubAuthentication = this.owner.lookup('service:hub-authentication');
    await settled();
    assert.ok(
      hubAuthentication.authToken === HUB_AUTH_TOKEN &&
        hubAuthentication.isAuthenticated,
      'authenticated'
    );

    hubAuthentication.authToken = null;

    assert.ok(
      !hubAuthentication.authToken && !hubAuthentication.isAuthenticated,
      'not authenticated'
    );
  });

  // test ensureAuthenticated
  test('it can reuse an existing valid auth token', async function (assert) {
    hubAuthentication = this.owner.lookup('service:hub-authentication');
    await settled();

    assert.ok(
      hubAuthentication.authToken === HUB_AUTH_TOKEN &&
        hubAuthentication.isAuthenticated,
      'authenticated'
    );

    let authenticateStub = sinon
      .stub(layer2Service, 'authenticate')
      .returns(Promise.resolve(HUB_AUTH_TOKEN));
    await hubAuthentication.ensureAuthenticated();

    assert.ok(authenticateStub.notCalled, 'Did not fetch a new auth token');
    assert.ok(
      hubAuthentication.authToken === HUB_AUTH_TOKEN &&
        hubAuthentication.isAuthenticated,
      'authenticated'
    );
  });

  test('it can fetch a new auth token when an existing one is invalid', async function (assert) {
    hubAuthentication = this.owner.lookup('service:hub-authentication');
    await settled();

    assert.ok(
      hubAuthentication.authToken === HUB_AUTH_TOKEN &&
        hubAuthentication.isAuthenticated,
      'authenticated'
    );

    sinon
      .stub(layer2Service, 'checkHubAuthenticationValid')
      .returns(Promise.resolve(false));
    let authenticateStub = sinon
      .stub(layer2Service, 'authenticate')
      .returns(Promise.resolve(HUB_AUTH_TOKEN));
    await hubAuthentication.ensureAuthenticated();

    assert.ok(
      authenticateStub.calledOnce,
      'Called the authenticate method to get a new auth token'
    );
    assert.ok(
      hubAuthentication.authToken === HUB_AUTH_TOKEN &&
        hubAuthentication.isAuthenticated,
      'authenticated'
    );
  });

  test("it can fetch a new auth token when one doesn't exist", async function (assert) {
    window.TEST__AUTH_TOKEN = undefined;
    hubAuthentication = this.owner.lookup('service:hub-authentication');
    await settled();

    assert.ok(
      !hubAuthentication.authToken && !hubAuthentication.isAuthenticated,
      'not authenticated'
    );

    let authenticateStub = sinon
      .stub(layer2Service, 'authenticate')
      .returns(Promise.resolve(HUB_AUTH_TOKEN));
    await hubAuthentication.ensureAuthenticated();

    assert.ok(
      authenticateStub.calledOnce,
      'Called the authenticate method to get a new auth token'
    );
    assert.ok(
      hubAuthentication.authToken === HUB_AUTH_TOKEN &&
        hubAuthentication.isAuthenticated,
      'authenticated'
    );
  });

  test('it throws an error when fetching a new auth token fails with an empty string', async function (assert) {
    hubAuthentication = this.owner.lookup('service:hub-authentication');
    await settled();

    assert.ok(
      hubAuthentication.authToken === HUB_AUTH_TOKEN &&
        hubAuthentication.isAuthenticated,
      'authenticated'
    );

    sinon.stub(layer2Service, 'authenticate').returns(Promise.resolve(''));
    sinon
      .stub(layer2Service, 'checkHubAuthenticationValid')
      .returns(Promise.resolve(false));

    await assert.rejects(
      hubAuthentication.ensureAuthenticated(),
      /Failed to fetch auth token/,
      'It fails with the error message for a falsey auth token'
    );
    assert.ok(
      !hubAuthentication.authToken && !hubAuthentication.isAuthenticated,
      'not authenticated'
    );
  });

  test('it throws an error when errors are thrown while fetching a new auth token', async function (assert) {
    hubAuthentication = this.owner.lookup('service:hub-authentication');
    await settled();

    assert.ok(
      hubAuthentication.authToken === HUB_AUTH_TOKEN &&
        hubAuthentication.isAuthenticated,
      'authenticated'
    );

    sinon.stub(layer2Service, 'authenticate').throws(new Error('A test error'));
    sinon
      .stub(layer2Service, 'checkHubAuthenticationValid')
      .returns(Promise.resolve(false));

    await assert.rejects(
      hubAuthentication.ensureAuthenticated(),
      /A test error/,
      'It fails with the error message from our stubbed function'
    );
    assert.ok(
      !hubAuthentication.authToken && !hubAuthentication.isAuthenticated,
      'not authenticated'
    );
  });
});
