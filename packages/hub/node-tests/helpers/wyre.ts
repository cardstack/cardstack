import { WyreOrder, WyreTransfer, WyreWallet } from '../../services/wyre';
import { adminWalletName } from '../../routes/wyre-callback';

export class StubWyreService {
  wyreTransferCallCount = 0;
  async getWalletByUserAddress(userAddress: string): Promise<WyreWallet | undefined> {
    return Promise.resolve(handleGetWyreWalletByUserAddress(userAddress));
  }
  async getWalletById(walletId: string): Promise<WyreWallet | undefined> {
    return Promise.resolve(handleGetWyreWalletById(walletId));
  }
  async getTransfer(transferId: string): Promise<WyreTransfer | undefined> {
    return Promise.resolve(handleGetWyreTransfer(transferId));
  }
  async getOrder(orderId: string): Promise<WyreOrder | undefined> {
    return Promise.resolve(handleGetWyreOrder(orderId));
  }
  async transfer(source: string, dest: string, amount: number, token: string): Promise<WyreTransfer | undefined> {
    this.wyreTransferCallCount++;
    return Promise.resolve(handleWyreTransfer(source, dest, amount, token));
  }
}

// these ID prefixes are part of wyre's own ID scheme
export const adminWalletId = 'WA_ADMIN_WALLET';
export const stubCustodialWalletId = 'WA_CUSTODIAL_WALLET';
export const stubWalletOrderTransferId = 'TF_WALLET_ORDER';
export const stubCustodialTransferId = 'TF_CUSTODIAL_TRANSFER';
export const stubWalletOrderId = 'WO_WALLET_ORDER';
export const stubUserAddress = '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13';
export const stubDepositAddress = '0x59faede86fb650d956ca633a5c1a21fa53fe151c'; // wyre always returns lowercase addresses
export const randomAddress = '0xb21851B00bd13C008f703A21DFDd292b28A736b3';

function handleGetWyreWalletByUserAddress(userAddress: string) {
  if (userAddress === adminWalletName) {
    return {
      id: adminWalletId,
      name: adminWalletName,
      callbackUrl: null,
      depositAddresses: {},
    };
  }
  return {
    id: 'WA_RANDOM_WALLET',
    name: 'random',
    callbackUrl: null,
    depositAddresses: {},
  };
}

function handleGetWyreWalletById(walletId: string) {
  if (walletId === stubCustodialWalletId) {
    return {
      id: stubCustodialWalletId,
      name: stubUserAddress.toLowerCase(),
      callbackUrl: null,
      depositAddresses: {
        ETH: stubDepositAddress,
      } as { [network: string]: string },
    };
  } else if (walletId === 'WA_DOES_NOT_EXIST') {
    return;
  }

  return {
    id: 'WA_RANDOM_WALLET',
    name: 'random',
    callbackUrl: null,
    depositAddresses: {},
  };
}

function handleGetWyreTransfer(transferId: string) {
  switch (transferId) {
    case stubWalletOrderTransferId:
      return {
        id: stubWalletOrderTransferId,
        status: 'COMPLETED' as 'COMPLETED',
        source: `walletorderholding:${stubWalletOrderId}`,
        dest: `wallet:${stubCustodialWalletId}`,
        sourceCurrency: 'DAI',
        destCurrency: 'DAI',
        destAmount: 100,
      };
    case stubCustodialTransferId:
      return {
        id: stubCustodialTransferId,
        status: 'COMPLETED' as 'COMPLETED',
        source: `wallet:${stubCustodialWalletId}`,
        dest: `wallet:${adminWalletId}`,
        sourceCurrency: 'DAI',
        destCurrency: 'DAI',
        destAmount: 100,
      };
    case 'TF_PENDING':
      return {
        id: 'TF_PENDING',
        status: 'PENDING' as 'PENDING',
        source: `wallet:${stubCustodialWalletId}`,
        dest: `wallet:${adminWalletId}`,
        sourceCurrency: 'DAI',
        destCurrency: 'DAI',
        destAmount: 100,
      };
    case `TF_NON_WALLET_ORDER_SOURCE`:
      return {
        id: `TF_NON_WALLET_ORDER_SOURCE`,
        status: 'COMPLETED' as 'COMPLETED',
        source: `wallet:${adminWalletId}`,
        dest: `wallet:${stubCustodialWalletId}`,
        sourceCurrency: 'DAI',
        destCurrency: 'DAI',
        destAmount: 100,
      };
    case `TF_NON_EXISTENT_WALLET_ORDER_SOURCE`:
      return {
        id: `TF_NON_EXISTENT_WALLET_ORDER_SOURCE`,
        status: 'COMPLETED' as 'COMPLETED',
        source: `walletorderholding:WO_DOES_NOT_EXIST`,
        dest: `wallet:${stubCustodialWalletId}`,
        sourceCurrency: 'DAI',
        destCurrency: 'DAI',
        destAmount: 100,
      };
    case `TF_WITH_WALLET_ORDER_TRANSFER_MISMATCH`:
      return {
        id: `TF_WITH_WALLET_ORDER_TRANSFER_MISMATCH`,
        status: 'COMPLETED' as 'COMPLETED',
        source: `walletorderholding:WO_TRANSFER_MISMATCH`,
        dest: `wallet:${stubCustodialWalletId}`,
        sourceCurrency: 'DAI',
        destCurrency: 'DAI',
        destAmount: 100,
      };
    case `TF_WITH_WALLET_ORDER_DEST_MISMATCH`:
      return {
        id: `TF_WITH_WALLET_ORDER_DEST_MISMATCH`,
        status: 'COMPLETED' as 'COMPLETED',
        source: `walletorderholding:WO_DEST_MISMATCH`,
        dest: `wallet:${stubCustodialWalletId}`,
        sourceCurrency: 'DAI',
        destCurrency: 'DAI',
        destAmount: 100,
      };
    case `TF_NON_ADMIN_TRANSFER`:
      return {
        id: `TF_NON_ADMIN_TRANSFER`,
        status: 'COMPLETED' as 'COMPLETED',
        source: `wallet:${stubCustodialWalletId}`,
        dest: `wallet:WA_NON_ADMIN_WALLET`,
        sourceCurrency: 'DAI',
        destCurrency: 'DAI',
        destAmount: 100,
      };
    case `TF_ADMIN_TRANSFER_SOURCE_MISMATCH`:
      return {
        id: stubCustodialTransferId,
        status: 'COMPLETED' as 'COMPLETED',
        source: `wallet:WA_RANDOM_WALLET`,
        dest: `wallet:${adminWalletId}`,
        sourceCurrency: 'DAI',
        destCurrency: 'DAI',
        destAmount: 100,
      };
  }
  return;
}

function handleGetWyreOrder(orderId: string) {
  switch (orderId) {
    case stubWalletOrderId:
      return {
        id: stubWalletOrderId,
        status: 'COMPLETE' as 'COMPLETE',
        purchaseAmount: 100,
        sourceCurrency: 'USD',
        destCurrency: 'DAI',
        transferId: stubWalletOrderTransferId,
        dest: `ethereum:${stubDepositAddress}`,
      };
    case 'WO_TRANSFER_MISMATCH':
      return {
        id: 'WO_TRANSFER_MISMATCH',
        status: 'COMPLETE' as 'COMPLETE',
        purchaseAmount: 100,
        sourceCurrency: 'USD',
        destCurrency: 'DAI',
        transferId: 'TF_MISMATCHED_TRANSFER',
        dest: `ethereum:${stubDepositAddress}`,
      };
    case 'WO_DEST_MISMATCH':
      return {
        id: 'WO_DEST_MISMATCH',
        status: 'COMPLETE' as 'COMPLETE',
        purchaseAmount: 100,
        sourceCurrency: 'USD',
        destCurrency: 'DAI',
        transferId: `TF_WITH_WALLET_ORDER_DEST_MISMATCH`,
        dest: `ethereum:${randomAddress}`,
      };
  }
  return;
}

function handleWyreTransfer(source: string, dest: string, amount: number, token: string) {
  expect(source).to.equal(stubCustodialWalletId);
  expect(dest).to.equal(adminWalletId);
  expect(amount).to.equal(100);
  expect(token).to.equal('DAI');

  return {
    id: stubCustodialTransferId,
    status: 'COMPLETED' as 'COMPLETED',
    source: `wallet:${source}`,
    dest: `wallet:${dest}`,
    sourceCurrency: token,
    destCurrency: token,
    destAmount: amount,
  };
}
