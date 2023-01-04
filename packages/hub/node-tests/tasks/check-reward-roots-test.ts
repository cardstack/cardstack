import { registry, setupHub } from '../helpers/server';
import { RewardPrograms, RewardRoots } from '../../services/subgraph';
import { Client as DBClient } from 'pg';
import CheckRewardRoots from '../../tasks/check-reward-roots';
import { setupStubWorkerClient } from '../helpers/stub-worker-client';

let stubGetRewardRoots: () => RewardRoots;
let stubRewardProgramIds: () => string[];

class StubSubgraph {
  async getRewardPrograms(): Promise<RewardPrograms> {
    let rewardProgramIds = stubRewardProgramIds();
    let results = {
      data: {
        rewardPrograms: rewardProgramIds.map((rewardProgramId) => {
          return {
            id: rewardProgramId,
          };
        }),
      },
    };
    return Promise.resolve(results);
  }

  async getRewardRoots(rewardProgramId: string, lastIndexedBlockNumber: number, limit = 100): Promise<RewardRoots> {
    let results = stubGetRewardRoots();
    // emulate subgraph filtering
    results.data.merkleRootSubmissions = results.data.merkleRootSubmissions
      .filter((o) => Number(o.paymentCycle) > Number(lastIndexedBlockNumber) && o.rewardProgram.id == rewardProgramId)
      .sort((a, b) => {
        return Number(a.paymentCycle) - Number(b.paymentCycle);
      })
      .slice(0, limit);
    return Promise.resolve(results);
  }
}

describe('CheckRewardRootsTask', function () {
  let db: DBClient;
  let { getJobIdentifiers, getJobPayloads } = setupStubWorkerClient(this);

  this.beforeEach(function () {
    registry(this).register('subgraph', StubSubgraph);
  });

  let { getContainer } = setupHub(this);

  this.beforeEach(async function () {
    let dbManager = await getContainer().lookup('database-manager');
    db = await dbManager.getClient();
    await db.query('DELETE FROM reward_root_index;');
  });

  it('triggers process root job', async function () {
    stubRewardProgramIds = () => [
      '0x0885ce31D73b63b0Fcb1158bf37eCeaD8Ff0fC72',
      '0xab20c80fcc025451a3fc73bB953aaE1b9f640949',
    ];

    stubGetRewardRoots = () => ({
      data: {
        merkleRootSubmissions: [
          {
            id: '0xe080a54ef1e2f26ed878bddbae23cfc446ba07911a8598cad9c7f22ca6c04767',
            blockNumber: '1',
            rootHash: '0xbed86a5cb881bf1e11a47a80949111fb140f26d85de62b2464a3726f914cd7a3',
            paymentCycle: '1',
            rewardProgram: {
              id: '0x0885ce31D73b63b0Fcb1158bf37eCeaD8Ff0fC72',
            },
          },
          {
            id: '0x363e809e2c5b0e94d3a28ffe4883b8daf991cae7d3fa5531d21cc951dd0f176f',
            blockNumber: '3',
            rootHash: '0x723957d0e3a7c2f3362619c09fee11c213a4fd5303d780cbdd4e5194e43f7da6',
            paymentCycle: '3',
            rewardProgram: {
              id: '0x0885ce31D73b63b0Fcb1158bf37eCeaD8Ff0fC72',
            },
          },
          {
            id: '0x66997beadcc07eb1dd1abca7bf67187da580106788cdaf69c00ceb65cdb3215d',
            blockNumber: '1',
            rootHash: '0xb772f8a1f506f62523ccafc6e6cd80ae826769aa5802bf9d138ce1e59851400b',
            paymentCycle: '1',
            rewardProgram: {
              id: '0xab20c80fcc025451a3fc73bB953aaE1b9f640949',
            },
          },
          {
            id: '0x927b2e1caed038349e96a9a2d40fce0c1af0ad2c9eaa7ff3af93293d4bc825fd',
            blockNumber: '2',
            rootHash: '0x96f89ae8e2c328bd7671d3487f449e0fe6daeb0bae7215fbda047345615460f5',
            paymentCycle: '2',
            rewardProgram: {
              id: '0xab20c80fcc025451a3fc73bB953aaE1b9f640949',
            },
          },
        ],
      },
    });
    let task = await getContainer().instantiate(CheckRewardRoots);
    await task.perform();
    expect(getJobIdentifiers()).to.deep.equal([
      'process-reward-root',
      'process-reward-root',
      'process-reward-root',
      'process-reward-root',
    ]);
    expect(getJobPayloads()).to.deep.equal([
      {
        blockNumber: '1',
        s3FileInfo: {
          paymentCycle: '1',
          rewardProgramId: '0x0885ce31D73b63b0Fcb1158bf37eCeaD8Ff0fC72',
        },
      },
      {
        blockNumber: '3',
        s3FileInfo: {
          paymentCycle: '3',
          rewardProgramId: '0x0885ce31D73b63b0Fcb1158bf37eCeaD8Ff0fC72',
        },
      },
      {
        blockNumber: '1',
        s3FileInfo: {
          paymentCycle: '1',
          rewardProgramId: '0xab20c80fcc025451a3fc73bB953aaE1b9f640949',
        },
      },
      {
        blockNumber: '2',
        s3FileInfo: {
          paymentCycle: '2',
          rewardProgramId: '0xab20c80fcc025451a3fc73bB953aaE1b9f640949',
        },
      },
    ]);
  });
  it('triggers process reward root job from last root index', async function () {
    stubRewardProgramIds = () => [
      '0x0885ce31D73b63b0Fcb1158bf37eCeaD8Ff0fC72',
      '0xab20c80fcc025451a3fc73bB953aaE1b9f640949',
    ];
    stubGetRewardRoots = () => ({
      data: {
        merkleRootSubmissions: [
          {
            id: '0xe080a54ef1e2f26ed878bddbae23cfc446ba07911a8598cad9c7f22ca6c04767',
            blockNumber: '1',
            rootHash: '0xbed86a5cb881bf1e11a47a80949111fb140f26d85de62b2464a3726f914cd7a3',
            paymentCycle: '1',
            rewardProgram: {
              id: '0x0885ce31D73b63b0Fcb1158bf37eCeaD8Ff0fC72',
            },
          },
          {
            id: '0x363e809e2c5b0e94d3a28ffe4883b8daf991cae7d3fa5531d21cc951dd0f176f',
            blockNumber: '3',
            rootHash: '0x723957d0e3a7c2f3362619c09fee11c213a4fd5303d780cbdd4e5194e43f7da6',
            paymentCycle: '3',
            rewardProgram: {
              id: '0x0885ce31D73b63b0Fcb1158bf37eCeaD8Ff0fC72',
            },
          },
          {
            id: '0x927b2e1caed038349e96a9a2d40fce0c1af0ad2c9eaa7ff3af93293d4bc825fd',
            blockNumber: '2',
            rootHash: '0x96f89ae8e2c328bd7671d3487f449e0fe6daeb0bae7215fbda047345615460f5',
            paymentCycle: '2',
            rewardProgram: {
              id: '0xab20c80fcc025451a3fc73bB953aaE1b9f640949',
            },
          },
        ],
      },
    });
    await db.query(
      "INSERT INTO reward_root_index( reward_program_id, payment_cycle, block_number) VALUES ( '0x0885ce31D73b63b0Fcb1158bf37eCeaD8Ff0fC72', '2', '2' )"
    );
    await db.query(
      "INSERT INTO reward_root_index( reward_program_id, payment_cycle, block_number) VALUES ( '0xab20c80fcc025451a3fc73bB953aaE1b9f640949', '2', '2' )"
    );
    let task = await getContainer().instantiate(CheckRewardRoots);
    await task.perform();
    expect(getJobIdentifiers()).to.deep.equal(['process-reward-root']);
    expect(getJobPayloads()).to.deep.equal([
      {
        blockNumber: '3',
        s3FileInfo: {
          paymentCycle: '3',
          rewardProgramId: '0x0885ce31D73b63b0Fcb1158bf37eCeaD8Ff0fC72',
        },
      },
    ]);
  });
  it('triggers process reward root job that contains a new payment cycle but from already indexed block number (the block number is redundant)', async function () {
    stubRewardProgramIds = () => ['0x0885ce31D73b63b0Fcb1158bf37eCeaD8Ff0fC72'];
    stubGetRewardRoots = () => ({
      data: {
        merkleRootSubmissions: [
          {
            id: '0xe080a54ef1e2f26ed878bddbae23cfc446ba07911a8598cad9c7f22ca6c04767',
            blockNumber: '1',
            rootHash: '0xbed86a5cb881bf1e11a47a80949111fb140f26d85de62b2464a3726f914cd7a3',
            paymentCycle: '2',
            rewardProgram: {
              id: '0x0885ce31D73b63b0Fcb1158bf37eCeaD8Ff0fC72',
            },
          },
        ],
      },
    });
    await db.query(
      "INSERT INTO reward_root_index( reward_program_id, payment_cycle, block_number) VALUES ( '0x0885ce31D73b63b0Fcb1158bf37eCeaD8Ff0fC72', '1', '1' )"
    );
    let task = await getContainer().instantiate(CheckRewardRoots);
    await task.perform();
    expect(getJobIdentifiers()).to.deep.equal(['process-reward-root']);
    expect(getJobPayloads()).to.deep.equal([
      {
        blockNumber: '1',
        s3FileInfo: {
          paymentCycle: '2',
          rewardProgramId: '0x0885ce31D73b63b0Fcb1158bf37eCeaD8Ff0fC72',
        },
      },
    ]);
  });
  it('trigger process reward root jobs within max index size', async function () {
    stubRewardProgramIds = () => ['0x0885ce31D73b63b0Fcb1158bf37eCeaD8Ff0fC72'];
    stubGetRewardRoots = () => ({
      data: {
        merkleRootSubmissions: [
          {
            id: '0xe080a54ef1e2f26ed878bddbae23cfc446ba07911a8598cad9c7f22ca6c04767',
            blockNumber: '1',
            rootHash: '0xbed86a5cb881bf1e11a47a80949111fb140f26d85de62b2464a3726f914cd7a3',
            paymentCycle: '1',
            rewardProgram: {
              id: '0x0885ce31D73b63b0Fcb1158bf37eCeaD8Ff0fC72',
            },
          },
          {
            id: '0x363e809e2c5b0e94d3a28ffe4883b8daf991cae7d3fa5531d21cc951dd0f176f',
            blockNumber: '2',
            rootHash: '0x723957d0e3a7c2f3362619c09fee11c213a4fd5303d780cbdd4e5194e43f7da6',
            paymentCycle: '2',
            rewardProgram: {
              id: '0x0885ce31D73b63b0Fcb1158bf37eCeaD8Ff0fC72',
            },
          },
          {
            id: '0x66997beadcc07eb1dd1abca7bf67187da580106788cdaf69c00ceb65cdb3215d',
            blockNumber: '3',
            rootHash: '0xb772f8a1f506f62523ccafc6e6cd80ae826769aa5802bf9d138ce1e59851400b',
            paymentCycle: '3',
            rewardProgram: {
              id: '0x0885ce31D73b63b0Fcb1158bf37eCeaD8Ff0fC72',
            },
          },
        ],
      },
    });
    let task = await getContainer().instantiate(CheckRewardRoots);
    let max_index_size_per_program = 2;
    await task.perform(max_index_size_per_program);
    expect(getJobIdentifiers()).to.deep.equal(['process-reward-root', 'process-reward-root']);
    expect(getJobPayloads()).to.deep.equal([
      {
        blockNumber: '1',
        s3FileInfo: {
          paymentCycle: '1',
          rewardProgramId: '0x0885ce31D73b63b0Fcb1158bf37eCeaD8Ff0fC72',
        },
      },
      {
        blockNumber: '2',
        s3FileInfo: {
          paymentCycle: '2',
          rewardProgramId: '0x0885ce31D73b63b0Fcb1158bf37eCeaD8Ff0fC72',
        },
      },
    ]);
  });
});
