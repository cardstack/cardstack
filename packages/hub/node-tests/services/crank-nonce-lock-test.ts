import { subSeconds } from 'date-fns';
import { ExtendedPrismaClient } from '../../services/prisma-manager';
import { nowUtc } from '../../utils/dates';
import { registry, setupHub } from '../helpers/server';
import BN from 'bn.js';
import CrankNonceLock from '../../services/crank-nonce-lock';
import { getWeb3ConfigByNetwork } from '@cardstack/cardpay-sdk';
import config from 'config';

class StubEthersProvider {
  getInstance(chainId: number) {
    let rpcUrl = getWeb3ConfigByNetwork({ web3: config.get('web3') }, chainId)?.rpcNodeHttpsUrl as string;
    if (!rpcUrl) {
      throw `chain id is not supported`;
    }
    return {
      getTransactionCount: async (addressOrName: string, blockTag?: string) => {
        if (!addressOrName && !blockTag) {
          throw 'address and blockTag cannot be null or undefined';
        }
        return Promise.resolve(10);
      },
    };
  }
}

describe.only('locking the nonce', function () {
  let subject: CrankNonceLock;
  let prisma: ExtendedPrismaClient;
  let chainId = 80001; //mumbai

  let { getPrisma, getContainer } = setupHub(this);

  this.beforeEach(async function () {
    prisma = await getPrisma();
    registry(this).register('ethers-provider', StubEthersProvider);
    subject = (await getContainer().lookup('crank-nonce-lock')) as CrankNonceLock;
  });

  it(`retrieves nonce to the blockchain because account's nonce doesn't exist in database`, async function () {
    let testFunc = async (nonce: BN) => {
      expect(nonce.toNumber()).equal(10); //equal with getTransactionCount result
    };
    await subject.withNonce(chainId, testFunc);

    let crankNonce = await prisma.crankNonce.findUnique({
      where: { chainId },
    });
    expect(crankNonce).not.undefined;
    expect(Number(crankNonce?.nonce ?? 0)).equal(10);
  });

  it(`retrieves nonce to the blockchain because nonce data in database equal 0`, async function () {
    await prisma.crankNonce.create({
      data: {
        chainId: chainId,
        nonce: 0,
      },
    });
    let testFunc = async (nonce: BN) => {
      expect(nonce.toNumber()).equal(10); //equal with getTransactionCount result
    };
    await subject.withNonce(chainId, testFunc);

    let crankNonce = await prisma.crankNonce.findUnique({
      where: { chainId },
    });
    expect(crankNonce).not.undefined;
    expect(Number(crankNonce?.nonce ?? 0)).equal(10);
  });

  it(`retrieves nonce to the blockchain because account nonce in database is expired`, async function () {
    let currentNonce = 2;
    await prisma.crankNonce.create({
      data: {
        chainId: chainId,
        nonce: currentNonce,
        createdAt: subSeconds(nowUtc(), subject.nonceTTL + 60),
        updatedAt: subSeconds(nowUtc(), subject.nonceTTL + 60),
      },
    });
    let testFunc = async (nonce: BN) => {
      expect(nonce.toNumber()).equal(10); //equal with getTransactionCount result
    };
    await subject.withNonce(chainId, testFunc);

    let crankNonce = await prisma.crankNonce.findUnique({
      where: { chainId },
    });
    expect(crankNonce).not.undefined;
    expect(Number(crankNonce?.nonce ?? 0)).equal(10);
  });

  it(`increases current nonce in database`, async function () {
    let currentNonce = 2;
    await prisma.crankNonce.create({
      data: {
        chainId: chainId,
        nonce: currentNonce,
      },
    });
    let testFunc = async (nonce: BN) => {
      expect(nonce.toNumber()).equal(currentNonce + 1);
    };
    await subject.withNonce(chainId, testFunc);

    let crankNonce = await prisma.crankNonce.findUnique({
      where: { chainId },
    });
    expect(crankNonce).not.undefined;
    expect(Number(crankNonce?.nonce ?? 0)).equal(currentNonce + 1);
  });

  it(`retrieves to the blockchain, after that increases nonce from database`, async function () {
    await prisma.crankNonce.create({
      data: {
        chainId: chainId,
        nonce: 0,
      },
    });
    let firstFunction = async (nonce: BN) => {
      expect(nonce.toNumber()).equal(10); //equal with getTransactionCount result
    };
    let _nonce = 10;
    await subject.withNonce(chainId, firstFunction);
    for (let i = 1; i <= 10; i++) {
      _nonce++;
      let secondFunction = async (nonce: BN) => {
        expect(nonce.toNumber()).equal(_nonce);
      };
      await subject.withNonce(chainId, secondFunction);

      let crankNonce = await prisma.crankNonce.findUnique({
        where: { chainId },
      });
      expect(crankNonce).not.undefined;
      expect(Number(crankNonce?.nonce ?? 0)).equal(_nonce);
    }
  });

  it(`rollback nonce if function execution throw an error`, async function () {
    let currentNonce = 2;
    await prisma.crankNonce.create({
      data: {
        chainId: chainId,
        nonce: currentNonce,
      },
    });
    let func = async (nonce: BN) => {
      expect(nonce.toNumber()).equal(currentNonce + 1);
      throw 'simulate error';
    };
    try {
      await subject.withNonce(chainId, func);
    } catch (e) {
      let crankNonce = await prisma.crankNonce.findUnique({
        where: { chainId },
      });
      expect(e).equal('simulate error');
      expect(crankNonce).not.undefined;
      expect(Number(crankNonce?.nonce ?? 0)).equal(currentNonce);
    }
  });
});
