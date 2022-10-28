import { subSeconds } from 'date-fns';
import shortUUID from 'short-uuid';
import { supportedChains } from '../../services/ethers-provider';
import NonceLock from '../../services/nonce-lock';
import { ExtendedPrismaClient } from '../../services/prisma-manager';
import { nowUtc } from '../../utils/dates';
import { registry, setupHub } from '../helpers/server';
import config from 'config';
import BN from 'bn.js';

class StubEthersProvider {
  getInstance(chainId: number) {
    let rpcUrl = supportedChains.find((chain) => chain.id === chainId)?.rpcUrl as string;
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

const nonceTTL = Number(config.get('nonceTTL'));
describe('locking the nonce', function () {
  let subject: NonceLock;
  let prisma: ExtendedPrismaClient;
  let accountAddress = '0x0CE00362735A9c00dcF5B345Af78b5aab136ef79'; //random address
  let chainId = 80001; //mumbai

  let { getPrisma, getContainer } = setupHub(this);

  this.beforeEach(async function () {
    prisma = await getPrisma();
    registry(this).register('ethers-provider', StubEthersProvider);
    subject = (await getContainer().lookup('nonce-lock')) as NonceLock;
  });

  it(`retrieves nonce to the blockchain because account's nonce doesn't exist in database`, async function () {
    await prisma.accountNonce.create({
      data: {
        id: shortUUID.uuid(),
        accountAddress: '0x0CE00362735A9c00dcF5B345Af78b5aab136ef78',
        chainId: chainId,
        nonce: 2,
        createdAt: nowUtc(),
        updatedAt: nowUtc(),
      },
    });
    let testFunc = async (nonce: BN) => {
      expect(nonce.toNumber()).equal(10); //equal with getTransactionCount result
    };
    await subject.withNonce(accountAddress, chainId, testFunc);

    let accountNonce = await prisma.accountNonce.findUnique({
      where: { accountAddress_chainId: { accountAddress, chainId } },
    });
    expect(accountNonce).not.undefined;
    expect(Number(accountNonce?.nonce ?? 0)).equal(10);
  });

  it(`retrieves nonce to the blockchain because nonce data in database equal 0`, async function () {
    await prisma.accountNonce.create({
      data: {
        id: shortUUID.uuid(),
        accountAddress,
        chainId: chainId,
        nonce: 0,
        createdAt: nowUtc(),
        updatedAt: nowUtc(),
      },
    });
    let testFunc = async (nonce: BN) => {
      expect(nonce.toNumber()).equal(10); //equal with getTransactionCount result
    };
    await subject.withNonce(accountAddress, chainId, testFunc);

    let accountNonce = await prisma.accountNonce.findUnique({
      where: { accountAddress_chainId: { accountAddress, chainId } },
    });
    expect(accountNonce).not.undefined;
    expect(Number(accountNonce?.nonce ?? 0)).equal(10);
  });

  it(`retrieves nonce to the blockchain because account nonce in database is expired`, async function () {
    let currentNonce = 2;
    await prisma.accountNonce.create({
      data: {
        id: shortUUID.uuid(),
        accountAddress,
        chainId: chainId,
        nonce: currentNonce,
        createdAt: subSeconds(nowUtc(), nonceTTL + 60),
        updatedAt: subSeconds(nowUtc(), nonceTTL + 60),
      },
    });
    let testFunc = async (nonce: BN) => {
      expect(nonce.toNumber()).equal(10); //equal with getTransactionCount result
    };
    await subject.withNonce(accountAddress, chainId, testFunc);

    let accountNonce = await prisma.accountNonce.findUnique({
      where: { accountAddress_chainId: { accountAddress, chainId } },
    });
    expect(accountNonce).not.undefined;
    expect(Number(accountNonce?.nonce ?? 0)).equal(10);
  });

  it(`increases current nonce in database`, async function () {
    let currentNonce = 2;
    await prisma.accountNonce.create({
      data: {
        id: shortUUID.uuid(),
        accountAddress,
        chainId: chainId,
        nonce: currentNonce,
        createdAt: nowUtc(),
        updatedAt: nowUtc(),
      },
    });
    let testFunc = async (nonce: BN) => {
      expect(nonce.toNumber()).equal(currentNonce + 1);
    };
    await subject.withNonce(accountAddress, chainId, testFunc);

    let accountNonce = await prisma.accountNonce.findUnique({
      where: { accountAddress_chainId: { accountAddress, chainId } },
    });
    expect(accountNonce).not.undefined;
    expect(Number(accountNonce?.nonce ?? 0)).equal(currentNonce + 1);
  });

  it(`retrieves to the blockchain, after that increases nonce from database`, async function () {
    await prisma.accountNonce.create({
      data: {
        id: shortUUID.uuid(),
        accountAddress,
        chainId: chainId,
        nonce: 0,
        createdAt: nowUtc(),
        updatedAt: nowUtc(),
      },
    });
    let firstFunction = async (nonce: BN) => {
      expect(nonce.toNumber()).equal(10); //equal with getTransactionCount result
    };
    let _nonce = 10;
    await subject.withNonce(accountAddress, chainId, firstFunction);
    for (let i = 1; i <= 10; i++) {
      _nonce++;
      let secondFunction = async (nonce: BN) => {
        expect(nonce.toNumber()).equal(_nonce);
      };
      await subject.withNonce(accountAddress, chainId, secondFunction);

      let accountNonce = await prisma.accountNonce.findUnique({
        where: { accountAddress_chainId: { accountAddress, chainId } },
      });
      expect(accountNonce).not.undefined;
      expect(Number(accountNonce?.nonce ?? 0)).equal(_nonce);
    }
  });

  it(`rollback nonce if function execution throw an error`, async function () {
    let currentNonce = 2;
    await prisma.accountNonce.create({
      data: {
        id: shortUUID.uuid(),
        accountAddress,
        chainId: chainId,
        nonce: currentNonce,
        createdAt: nowUtc(),
        updatedAt: nowUtc(),
      },
    });
    let func = async (nonce: BN) => {
      expect(nonce.toNumber()).equal(currentNonce + 1);
      throw 'simulate error';
    };
    try {
      await subject.withNonce(accountAddress, chainId, func);
    } catch (e) {
      let accountNonce = await prisma.accountNonce.findUnique({
        where: { accountAddress_chainId: { accountAddress, chainId } },
      });
      expect(e).equal('simulate error');
      expect(accountNonce).not.undefined;
      expect(Number(accountNonce?.nonce ?? 0)).equal(currentNonce);
    }
  });
});
