import { inject } from '@cardstack/di';
import { Prisma } from '@prisma/client';
import BN from 'bn.js';
import config from 'config';
import { addSeconds } from 'date-fns';
import { nowUtc } from '../utils/dates';

export default class NonceLock {
  prismaManager = inject('prisma-manager', { as: 'prismaManager' });
  ethersProvider = inject('ethers-provider', { as: 'ethersProvider' });

  private async getNonce(accountAddress: string, chainId: number, dbTransaction: Prisma.TransactionClient) {
    await dbTransaction.$executeRaw`SELECT * FROM account_nonces WHERE account_address = ${accountAddress} AND chain_id = ${chainId} FOR UPDATE`;

    let accountNonce = await dbTransaction.accountNonce.findUnique({
      where: { accountAddress_chainId: { accountAddress, chainId } },
    });
    let one = new BN(1);
    let nextNonce = accountNonce?.nonce ? new BN(accountNonce.nonce.toString()).add(one) : new BN(0);
    let nonceTTL = Number(config.get('nonceTTL'));
    let now = nowUtc();
    if (nextNonce.cmp(one) <= 0 || (accountNonce && addSeconds(accountNonce.updatedAt, nonceTTL) <= now)) {
      let provider = this.ethersProvider.getInstance(chainId);
      nextNonce = new BN(await provider.getTransactionCount(accountAddress, 'latest'));
    }

    await dbTransaction.accountNonce.upsert({
      where: { accountAddress_chainId: { accountAddress, chainId } },
      create: {
        accountAddress,
        chainId,
        nonce: BigInt(nextNonce.toString()),
      },
      update: {
        nonce: BigInt(nextNonce.toString()),
      },
    });

    return nextNonce;
  }

  async withNonce(accountAddress: string, chainId: number, cb: (nonce: BN) => Promise<any>) {
    let prisma = await this.prismaManager.getClient();
    return await prisma.$transaction(
      async (tx) => {
        let nonce = await this.getNonce(accountAddress, chainId, tx);
        return await cb(nonce);
      },
      { maxWait: 3000, timeout: 10000 }
    );
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'nonce-lock': NonceLock;
  }
}
