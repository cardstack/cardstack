import config from 'config';
import fetch from 'node-fetch';

const env = config.get('hubEnvironment') as string;

interface WyreConfig {
  accountId: string;
  apiKey: string;
  secretKey: string;
  url: string;
  callbackUrl: string;
}

export interface WyreWallet {
  id: string;
  name: string;
  callbackUrl: string | null;
  depositAddresses: {
    [network: string]: string;
  };
}

export interface WyreTransfer {
  id: string;
  status: 'PREVIEW' | 'UNCONFIRMED' | 'PENDING' | 'COMPLETED' | 'EXPIRED' | 'FAILED' | 'REVERSED';
  source: string;
  dest: string;
  destCurrency: string;
  sourceCurrency: string;
  destAmount: number;
}

export interface WyreOrder {
  id: string;
  status: 'RUNNING_CHECKS' | 'PROCESSING' | 'FAILED' | 'COMPLETE';
  purchaseAmount: number;
  sourceCurrency: string;
  destCurrency: string;
  transferId: string;
  dest: string;
}

export default class WyreService {
  private get config() {
    return config.get('wyre') as WyreConfig;
  }

  async createWallet(address: string): Promise<WyreWallet> {
    let { url, secretKey, callbackUrl } = this.config;
    let result = await fetch(`${url}/v2/wallets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secretKey}`,
      },
      body: JSON.stringify({
        name: `${env}_${address.toLowerCase()}`,
        callbackUrl,
      }),
    });
    let wyreWallet = (await result.json()) as WyreWallet;
    return wyreWallet;
  }

  async getWalletByUserAddress(address: string): Promise<WyreWallet | undefined> {
    let { url } = this.config;
    let wallet = await this.getWallet(new URL(`${url}/v2/wallet?name=${env}_${address.toLowerCase()}`));
    if (wallet) {
      wallet.name = wallet.name.replace(`${env}_`, '');
    }
    return wallet;
  }

  async getWalletById(walletId: string): Promise<WyreWallet | undefined> {
    let { url } = this.config;
    let wallet = await this.getWallet(new URL(`${url}/v2/wallet/${walletId}`));
    if (wallet) {
      wallet.name = wallet.name.replace(`${env}_`, '');
    }
    return wallet;
  }

  async getTransfer(transferId: string): Promise<WyreTransfer | undefined> {
    let { secretKey, url } = this.config;
    let result = await fetch(`${url}/v3/transfers/${transferId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secretKey}`,
      },
    });
    // when no transfer exists for the name specified wyre returns a 204 no-content
    if (result.status === 204) {
      return;
    }
    let transfer = (await result.json()) as WyreTransfer;
    return transfer;
  }

  async getOrder(orderId: string): Promise<WyreOrder | undefined> {
    let { secretKey, url } = this.config;
    let result = await fetch(`${url}/v3/orders/${orderId}/full`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secretKey}`,
      },
    });
    // when no transfer exists for the name specified wyre returns a 204 no-content
    if (result.status === 204) {
      return;
    }
    let order = (await result.json()) as WyreOrder;
    return order;
  }

  async transfer(source: string, dest: string, amount: number, token: string): Promise<WyreTransfer> {
    let { url, secretKey } = this.config;
    let result = await fetch(`${url}/v3/transfers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secretKey}`,
      },
      body: JSON.stringify({
        source: `wallet:${source}`,
        dest: `wallet:${dest}`,
        sourceCurrency: token,
        sourceAmount: amount,
        autoConfirm: true,
        muteMessages: true,
      }),
    });
    let transfer = (await result.json()) as WyreTransfer;
    return transfer;
  }

  private async getWallet(url: URL): Promise<WyreWallet | undefined> {
    let { secretKey } = this.config;
    let result = await fetch(url.href, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secretKey}`,
      },
    });
    // when no wallet exists for the name specified wyre returns a 204 no-content
    if (result.status === 204) {
      return;
    }
    let wyreWallet = (await result.json()) as WyreWallet;
    return wyreWallet;
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    wyre: WyreService;
  }
}
