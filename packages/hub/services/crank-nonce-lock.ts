import { inject } from '@cardstack/di';
import { Prisma } from '@prisma/client';
import BN from 'bn.js';
import config from 'config';
import { addMilliseconds } from 'date-fns';
import { Wallet } from 'ethers';
import { nowUtc } from '../utils/dates';

export default class CrankNonceLock {
  prismaManager = inject('prisma-manager', { as: 'prismaManager' });
  ethersProvider = inject('ethers-provider', { as: 'ethersProvider' });
  readonly CRANK_LOCK_KEY = 1;
  readonly nonceTTL = 120000; //2 minutes

  private async getNonce(chainId: number, dbTransaction: Prisma.TransactionClient) {
    let crankNonce = await dbTransaction.crankNonce.findUnique({
      where: { chainId: chainId },
    });
    let one = new BN(1);
    let nextNonce = crankNonce?.nonce ? new BN(crankNonce.nonce.toString()).add(one) : new BN(0);
    let now = nowUtc();
    if (nextNonce.lte(one) || (crankNonce && addMilliseconds(crankNonce.updatedAt, this.nonceTTL) <= now)) {
      let crank = new Wallet(config.get('hubPrivateKey'));
      let provider = this.ethersProvider.getInstance(chainId);
      nextNonce = new BN(await provider.getTransactionCount(crank.address, 'latest'));
    }

    await dbTransaction.crankNonce.upsert({
      where: { chainId: chainId },
      create: {
        chainId,
        nonce: BigInt(nextNonce.toString()),
      },
      update: {
        nonce: BigInt(nextNonce.toString()),
        updatedAt: nowUtc(),
      },
    });

    return nextNonce;
  }

  async withNonce(chainId: number, cb: (nonce: BN) => Promise<any>) {
    let prisma = await this.prismaManager.getClient();

    //Make database transaction here
    //because if the execution failed the nonce should be rollback
    return await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${this.CRANK_LOCK_KEY})`;
        let nonce = await this.getNonce(chainId, tx);
        return await cb(nonce);
      },
      //10s timeout is to wait
      //until the transaction sent to the RPC node
      //don't wait the transaction to be mined
      { maxWait: 3000, timeout: 10000 }
    );
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'crank-nonce-lock': CrankNonceLock;
  }
}
