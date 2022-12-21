import { setupHub } from '../helpers/server';
import { Client as DBClient } from 'pg';
// import { setupStubWorkerClient } from '../helpers/stub-worker-client';
import { sdkStreamMixin } from '@aws-sdk/util-stream-node';
import { mockClient } from 'aws-sdk-client-mock';
import { S3Client, SelectObjectContentCommand } from '@aws-sdk/client-s3';
import { createReadStream } from 'fs';
import path from 'path';
import ProcessRewardRoot from '../../tasks/process-reward-root';

describe('ProcessRewardRootTask', function () {
  let db: DBClient;
  // let s3Client: S3Client;
  // let { getJobIdentifiers, getJobPayloads } = setupStubWorkerClient(this);

  // this.beforeEach(function () {
  //   // registry(this).register('subgraph', StubSubgraph);
  // });

  let { getContainer } = setupHub(this);

  this.beforeEach(async function () {
    let dbManager = await getContainer().lookup('database-manager');
    db = await dbManager.getClient();
    await db.query('DELETE FROM reward_root_index;');
    await db.query('DELETE FROM reward_proofs');
  });

  it.only('index parquet file into db', async function () {
    const s3Mock = mockClient(S3Client);
    s3Mock.on(SelectObjectContentCommand).resolves({});
    // const stream = new Readable();
    // stream.push('hello world');
    // stream.push(null); // end of stream
    const rewardProgramId = '0x0885ce31D73b63b0Fcb1158bf37eCeaD8Ff0fC72';
    const paymentCycle = '27736956';

    const stream = createReadStream(
      path.resolve(
        __dirname,
        `../mock-data/s3-rewards/rewardProgramID=${rewardProgramId}/paymentCycle=${paymentCycle}/results.parquet`
      )
    );
    const sdkStream = sdkStreamMixin(stream);
    s3Mock.on(SelectObjectContentCommand).resolves({ Payload: sdkStream });
    let task = await getContainer().instantiate(ProcessRewardRoot);
    await task.perform({
      rewardProgramId: rewardProgramId,
      paymentCycle: paymentCycle,
    });
  });
  it('index old parquet file with explanationData column as map<str,str>', async function () {});
  it('fails to index file if reward root has been indexed', async function () {});
});
