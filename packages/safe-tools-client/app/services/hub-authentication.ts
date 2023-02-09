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
    const authTokens = this.storage.getItem('authTokens');
    if (!this.wallet.address || !authTokens) return null;
    const authTokensObj = JSON.parse(authTokens);
    return authTokensObj[this.wallet.address];
  }

  set authToken(val: string | null) {
    if (val) {
      const authTokens = this.storage.getItem('authTokens');
      const authTokensObj = authTokens ? JSON.parse(authTokens) : {};
      if (this.wallet.address) authTokensObj[this.wallet.address] = val;
      this.storage.setItem('authTokens', JSON.stringify(authTokensObj));
    } else {
      this.isAuthenticated = false;
      this.storage.removeItem('authTokens');
    }
  }

  async hasValidAuthentication() {
    const hubAuth = await this.getHubAuth();
    try {
      const authAddress = this.authToken
        ? await hubAuth.getAddress(this.authToken)
        : null;
      return Boolean(
        this.wallet.isConnected && authAddress === this.wallet.address
      );
    } catch (e) {
      return false;
    }
  }
}

declare module '@ember/service' {
  interface Registry {
    hubAuthentication: HubAuthenticationService;
  }
}
