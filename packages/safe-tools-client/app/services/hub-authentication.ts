import { getSDK } from '@cardstack/cardpay-sdk';
import config from '@cardstack/safe-tools-client/config/environment';
import WalletService from '@cardstack/safe-tools-client/services/wallet';
import { getOwner } from '@ember/application';
import Service, { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';

export default class HubAuthenticationService extends Service {
  storage: Storage;
  @service declare wallet: WalletService;
  @tracked isAuthenticated: boolean | null = null;

  constructor(parameters?: object | undefined) {
    super(parameters);
    this.storage =
      (getOwner(this).lookup('storage:local') as Storage) ||
      window.localStorage;
  }

  async updateAuthenticationValidity() {
    this.isAuthenticated = await this.hasValidAuthentication();
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
    const ethersProvider = this.wallet.ethersProvider;
    return await getSDK('HubAuth', ethersProvider, config.hubUrl);
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

declare module '@ember/service' {
  interface Registry {
    hubAuthentication: HubAuthenticationService;
  }
}
