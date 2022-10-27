import { inject } from '@cardstack/di';
import BN from 'bn.js';
import config from 'config';
import { addSeconds } from 'date-fns';
import shortUUID from 'short-uuid';
import { nowUtc } from '../utils/dates';

export default class NonceLock {
  prismaManager = inject('prisma-manager', { as: 'prismaManager' });
  ethersProvider = inject('ethers-provider', { as: 'ethersProvider' });

  private async getNonce(accountAddress: string, chainId: number) {
    let prisma = await this.prismaManager.getClient();
    return await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT * FROM account_nonces WHERE account_address = ${accountAddress} AND chain_id = ${chainId} FOR UPDATE`;

        let accountNonce = await tx.accountNonce.findUnique({
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

        if (accountNonce) {
          await tx.accountNonce.update({
            where: { id: accountNonce.id },
            data: {
              nonce: BigInt(nextNonce.toString()),
              updatedAt: now,
            },
          });
        } else {
          await tx.accountNonce.create({
            data: {
              id: shortUUID.uuid(),
              accountAddress,
              chainId,
              nonce: BigInt(nextNonce.toString()),
              createdAt: now,
              updatedAt: now,
            },
          });
        }

        return nextNonce;
      },
      { maxWait: 3000, timeout: 10000 }
    );
  }

  async withNonce(accountAddress: string, chainId: number, cb: (nonce: BN) => Promise<any>) {
    let prisma = await this.prismaManager.getClient();
    let nonce = await this.getNonce(accountAddress, chainId);
    try {
      return await cb(nonce);
    } catch (e) {
      await prisma.accountNonce.update({
        where: { accountAddress_chainId: { accountAddress, chainId } },
        data: {
          nonce: 0,
          updatedAt: nowUtc(),
        },
      });
      throw e;
    }
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'nonce-lock': NonceLock;
  }
}
