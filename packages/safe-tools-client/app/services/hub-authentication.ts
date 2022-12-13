import { getSDK, Web3Provider } from '@cardstack/cardpay-sdk';
import WalletService from '@cardstack/safe-tools-client/services/wallet';
import Service, { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';

export default class HubAuthenticationService extends Service {
  storage: Storage;
  @service declare wallet: WalletService;
  @tracked isAuthenticated = false;
  hubUrl = 'http://localhost:3000'; // TODO - get this from the config

  constructor(parameters?: object | undefined) {
    super(parameters);

    this.storage = window.localStorage;
  }

  async ensureAuthenticated(): Promise<void> {
    if (await this.hasValidAuthentication()) {
      return;
    }

    try {
      const hubAuth = await this.getHubAuth();
      const newAuthToken = await hubAuth.authenticate();

      if (newAuthToken) {
        this.authToken = newAuthToken;
        this.isAuthenticated = true;
      } else {
        this.authToken = null;
        throw new Error('Failed to fetch auth token');
      }
    } catch (e) {
      this.authToken = null;
      throw e;
    }
  }

  async getHubAuth() {
    const ethersProvider = new Web3Provider(this.wallet.web3.currentProvider);

    const hubAuth = await getSDK('HubAuth', ethersProvider, this.hubUrl);

    return hubAuth;
  }

  get authToken(): string | null {
    return this.storage.getItem('authToken');
  }

  set authToken(val: string | null) {
    if (val) {
      this.storage.setItem('authToken', val);
    } else {
      this.isAuthenticated = false;
      this.storage.removeItem('authToken');
    }
  }

  async hasValidAuthentication() {
    const hubAuth = await this.getHubAuth();

    return Boolean(
      this.wallet.isConnected &&
        this.authToken &&
        (await hubAuth.checkValidAuth(this.authToken))
    );
  }
}
