import { setupHub } from '../helpers/server';
import { Client as DBClient } from 'pg';
import { mockClient, AwsStub } from 'aws-sdk-client-mock';
import { S3Client, SelectObjectContentCommand, ServiceInputTypes, ServiceOutputTypes } from '@aws-sdk/client-s3';
import ProcessRewardRoot from '../../tasks/process-reward-root';

const toUintArray = (proofs: any[]) => {
  return Buffer.from(proofs.reduce((accum: string, o: any) => accum.concat(JSON.stringify(o) + '\n'), ''));
};
const mockGetProofs = async (proofs: any[], start: number, end: number) => {
  // this function simulates pagination
  if (start > proofs.length) {
    return [];
  } else {
    return proofs.slice(start, end);
  }
};
const mockResponse = (proofs: any[], maxPaginate = 100) => {
  // this function returns succesful aws s3 select response
  // mockPayload is an async iterable (typically is used for paginated response from aws services)
  const mockPayload = {
    [Symbol.asyncIterator](): any {
      let start = 0;
      return {
        async next() {
          const o = await mockGetProofs(proofs, start, start + maxPaginate);
          if (o.length == 0) {
            return {
              done: true,
              value: {
                End: {},
              },
            };
          } else {
            start += maxPaginate;
            return {
              done: false,
              value: {
                Records: { Payload: toUintArray(o) },
              },
            };
          }
        },
      };
    },
  };
  return {
    $metadata: {
      httpStatusCode: 200,
      requestId: undefined,
      extendedRequestId: 'wk4e/KCPKuYUtJXwlvQkXnYrnBEpwuoVAEQhJuMpJbrc6GG47hqvISuMoUtSk1drj9imwwwe/2A=',
      cfId: undefined,
      attempts: 1,
      totalRetryDelay: 0,
    },
    Payload: mockPayload,
  };
};
describe('ProcessRewardRootTask', function () {
  let db: DBClient;
  let s3Mock: AwsStub<ServiceInputTypes, ServiceOutputTypes>;
  let { getContainer } = setupHub(this);

  this.beforeEach(async function () {
    let dbManager = await getContainer().lookup('database-manager');
    db = await dbManager.getClient();
    await db.query('DELETE FROM reward_root_index;');
    await db.query('DELETE FROM reward_proofs');
    s3Mock = mockClient(S3Client);
  });

  it('index parquet file into db', async function () {
    // the data here represents the json returned in s3 select
    // we bypass the use of dealing with parquet so we recreate the returned objects so no parquet parsing is required
    // although we require to to convert the data to UintArray
    const mockProofs = [
      {
        rewardProgramID: '0x0885ce31D73b63b0Fcb1158bf37eCeaD8Ff0fC72',
        paymentCycle: 27736956,
        validFrom: 27736956,
        validTo: 28514556,
        tokenType: 1,
        payee: '0x159ADe032073d930E85f95AbBAB9995110c43C71',
        root: '0x85a9034e056319d877c4e79d68480cd873858bdd36607c5ce5be40c62c8e5dd2',
        leaf: '0x0000000000000000000000000885ce31d73b63b0fcb1158bf37ecead8ff0fc720000000000000000000000000000000000000000000000000000000001a73b7c0000000000000000000000000000000000000000000000000000000001a73b7c0000000000000000000000000000000000000000000000000000000001b318fc0000000000000000000000000000000000000000000000000000000000000001000000000000000000000000159ade032073d930e85f95abbab9995110c43c7100000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000040000000000000000000000000b0427e9f03eb448d030be3ebc96f423857ceeb2f0000000000000000000000000000000000000000000000008ac7230489e80000',
        proof: [{ item: '930827dc0d480d868a190233dec74d8a149be25760ba4fa08d36c6b219209b86' }],
        explanationId: 'flat_payment',
        explanationData: '{"amount": "10000000000000000000", "token": "0xB0427e9F03Eb448D030bE3EBC96F423857ceEb2f"}',
      },
      {
        rewardProgramID: '0x0885ce31D73b63b0Fcb1158bf37eCeaD8Ff0fC72',
        paymentCycle: 27736956,
        validFrom: 27736956,
        validTo: 28514556,
        tokenType: 1,
        payee: '0x388CFef0AB326AEEB4167bab20c189ECab686370',
        root: '0x85a9034e056319d877c4e79d68480cd873858bdd36607c5ce5be40c62c8e5dd2',
        leaf: '0x0000000000000000000000000885ce31d73b63b0fcb1158bf37ecead8ff0fc720000000000000000000000000000000000000000000000000000000001a73b7c0000000000000000000000000000000000000000000000000000000001a73b7c0000000000000000000000000000000000000000000000000000000001b318fc0000000000000000000000000000000000000000000000000000000000000001000000000000000000000000388cfef0ab326aeeb4167bab20c189ecab68637000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000040000000000000000000000000b0427e9f03eb448d030be3ebc96f423857ceeb2f0000000000000000000000000000000000000000000000008ac7230489e80000',
        proof: [{ item: '66c2bccec52761541e307f888a0da4f44130ae7f8c634dfe0f34c569f3682433' }],
        explanationId: 'flat_payment',
        explanationData: '{"amount": "10000000000000000000", "token": "0xB0427e9F03Eb448D030bE3EBC96F423857ceEb2f"}',
      },
    ];
    const mockData = mockResponse(mockProofs);
    s3Mock.on(SelectObjectContentCommand).resolves(mockData);
    const rewardProgramId = mockProofs[0].rewardProgramID;
    const paymentCycle = mockProofs[0].paymentCycle;
    let task = await getContainer().instantiate(ProcessRewardRoot);
    await task.perform({
      blockNumber: '1',
      rewardProgramId: rewardProgramId,
      paymentCycle: String(paymentCycle),
    });
    const { rows } = await db.query('SELECT * FROM reward_proofs;');
    expect(rows.length).to.be.equal(2);
    rows.map((o) => {
      expect(o.reward_program_id).to.be.equal(rewardProgramId);
      expect(o.payment_cycle).to.be.equal(paymentCycle);
      expect(o.leaf.startsWith('0x')).to.be.true;
      o.proof_bytes.map((p: string) => {
        expect(p.startsWith('0x'));
      });
      expect(o.explanation_id).to.be.equal('flat_payment');
      expect(o.explanation_data).to.be.deep.equal({
        amount: '10000000000000000000',
        token: '0xB0427e9F03Eb448D030bE3EBC96F423857ceEb2f',
      });
    });
    const { rows: index } = await db.query('SELECT * FROM reward_root_index;');
    expect(index[0].reward_program_id).to.be.equal(rewardProgramId);
    expect(index[0].payment_cycle).to.be.equal(paymentCycle);
  });
  it('does not index file that has already been indexed', async function () {
    const mockProofs = [
      {
        rewardProgramID: '0x0885ce31D73b63b0Fcb1158bf37eCeaD8Ff0fC72',
        paymentCycle: 27736956,
        validFrom: 27736956,
        validTo: 28514556,
        tokenType: 1,
        payee: '0x159ADe032073d930E85f95AbBAB9995110c43C71',
        root: '0x85a9034e056319d877c4e79d68480cd873858bdd36607c5ce5be40c62c8e5dd2',
        leaf: '0x0000000000000000000000000885ce31d73b63b0fcb1158bf37ecead8ff0fc720000000000000000000000000000000000000000000000000000000001a73b7c0000000000000000000000000000000000000000000000000000000001a73b7c0000000000000000000000000000000000000000000000000000000001b318fc0000000000000000000000000000000000000000000000000000000000000001000000000000000000000000159ade032073d930e85f95abbab9995110c43c7100000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000040000000000000000000000000b0427e9f03eb448d030be3ebc96f423857ceeb2f0000000000000000000000000000000000000000000000008ac7230489e80000',
        proof: [{ item: '930827dc0d480d868a190233dec74d8a149be25760ba4fa08d36c6b219209b86' }],
        explanationId: 'flat_payment',
        explanationData: '{"amount": "10000000000000000000", "token": "0xB0427e9F03Eb448D030bE3EBC96F423857ceEb2f"}',
      },
      {
        rewardProgramID: '0x0885ce31D73b63b0Fcb1158bf37eCeaD8Ff0fC72',
        paymentCycle: 27736956,
        validFrom: 27736956,
        validTo: 28514556,
        tokenType: 1,
        payee: '0x388CFef0AB326AEEB4167bab20c189ECab686370',
        root: '0x85a9034e056319d877c4e79d68480cd873858bdd36607c5ce5be40c62c8e5dd2',
        leaf: '0x0000000000000000000000000885ce31d73b63b0fcb1158bf37ecead8ff0fc720000000000000000000000000000000000000000000000000000000001a73b7c0000000000000000000000000000000000000000000000000000000001a73b7c0000000000000000000000000000000000000000000000000000000001b318fc0000000000000000000000000000000000000000000000000000000000000001000000000000000000000000388cfef0ab326aeeb4167bab20c189ecab68637000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000040000000000000000000000000b0427e9f03eb448d030be3ebc96f423857ceeb2f0000000000000000000000000000000000000000000000008ac7230489e80000',
        proof: [{ item: '66c2bccec52761541e307f888a0da4f44130ae7f8c634dfe0f34c569f3682433' }],
        explanationId: 'flat_payment',
        explanationData: '{"amount": "10000000000000000000", "token": "0xB0427e9F03Eb448D030bE3EBC96F423857ceEb2f"}',
      },
    ];
    const mockData = mockResponse(mockProofs);
    s3Mock.on(SelectObjectContentCommand).resolves(mockData);
    const rewardProgramId = mockProofs[0].rewardProgramID;
    const paymentCycle = mockProofs[0].paymentCycle;
    let task = await getContainer().instantiate(ProcessRewardRoot);
    await task.perform({
      blockNumber: '1',
      rewardProgramId: rewardProgramId,
      paymentCycle: String(paymentCycle),
    });

    //duplicate indexing
    await db.query('BEGIN');
    const res = await task.perform({
      blockNumber: '1',
      rewardProgramId: rewardProgramId,
      paymentCycle: String(paymentCycle),
    });
    await db.query('COMMIT');
    if (res == undefined) {
      //have to rollback because test db doesn't implement begin, commit, rollback for performTRansaction
      await db.query('ROLLBACK');
    }
    const { rows } = await db.query('SELECT * FROM reward_proofs;');
    expect(rows.length).to.be.equal(2);
    const { rows: index } = await db.query('SELECT * FROM reward_root_index;');
    expect(index[0].reward_program_id).to.be.equal(rewardProgramId);
    expect(index[0].payment_cycle).to.be.equal(paymentCycle);
  });
  it('index old parquet file with explanationData column as map<str,str>', async function () {
    const mockProofs = [
      {
        rewardProgramID: '0x0885ce31D73b63b0Fcb1158bf37eCeaD8Ff0fC72',
        paymentCycle: 27722077,
        validFrom: 27722077,
        validTo: 28499677,
        tokenType: 1,
        payee: '0x159ADe032073d930E85f95AbBAB9995110c43C71',
        root: '0x2c7f1466e5b1d6958e8cb52dab3cdcd115a52e7171ac5d70c6000648a0163c30',
        leaf: '0000000000000000000000000885ce31d73b63b0fcb1158bf37ecead8ff0fc720000000000000000000000000000000000000000000000000000000001a7015d0000000000000000000000000000000000000000000000000000000001a7015d0000000000000000000000000000000000000000000000000000000001b2dedd0000000000000000000000000000000000000000000000000000000000000001000000000000000000000000159ade032073d930e85f95abbab9995110c43c7100000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000040000000000000000000000000b0427e9f03eb448d030be3ebc96f423857ceeb2f0000000000000000000000000000000000000000000000008ac7230489e80000',
        proof: [{ item: '7019252fd21c2f404fb5834aa1a098b64a8c52504b9a83a25fdc732a3834c579' }],
        explanationId: 'flat_payment',
        explanationData: {
          amount: '10000000000000000000',
          token: '0xB0427e9F03Eb448D030bE3EBC96F423857ceEb2f',
        },
      },
      {
        rewardProgramID: '0x0885ce31D73b63b0Fcb1158bf37eCeaD8Ff0fC72',
        paymentCycle: 27722077,
        validFrom: 27722077,
        validTo: 28499677,
        tokenType: 1,
        payee: '0x691fC14ed06A091e657b70ec9E5Eb72d17396694',
        root: '0x2c7f1466e5b1d6958e8cb52dab3cdcd115a52e7171ac5d70c6000648a0163c30',
        leaf: '0000000000000000000000000885ce31d73b63b0fcb1158bf37ecead8ff0fc720000000000000000000000000000000000000000000000000000000001a7015d0000000000000000000000000000000000000000000000000000000001a7015d0000000000000000000000000000000000000000000000000000000001b2dedd0000000000000000000000000000000000000000000000000000000000000001000000000000000000000000691fc14ed06a091e657b70ec9e5eb72d1739669400000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000040000000000000000000000000b0427e9f03eb448d030be3ebc96f423857ceeb2f0000000000000000000000000000000000000000000000008ac7230489e80000',
        proof: [{ item: '09741092149356a58c47dae710a25e0e05cda00b69e5f18d21c3674e360a83bd' }],
        explanationId: 'flat_payment',
        explanationData: {
          amount: '10000000000000000000',
          token: '0xB0427e9F03Eb448D030bE3EBC96F423857ceEb2f',
        },
      },
    ];
    const mockData = mockResponse(mockProofs);
    s3Mock.on(SelectObjectContentCommand).resolves(mockData);
    const rewardProgramId = mockProofs[0].rewardProgramID;
    const paymentCycle = mockProofs[0].paymentCycle;
    let task = await getContainer().instantiate(ProcessRewardRoot);
    await task.perform({
      blockNumber: '1',
      rewardProgramId: rewardProgramId,
      paymentCycle: String(paymentCycle),
    });
    const { rows } = await db.query('SELECT * FROM reward_proofs;');
    expect(rows.length).to.be.equal(2);
    rows.map((o) => {
      expect(o.reward_program_id).to.be.equal(rewardProgramId);
      expect(o.payment_cycle).to.be.equal(paymentCycle);
      expect(o.leaf.startsWith('0x')).to.be.true;
      o.proof_bytes.map((p: string) => {
        expect(p.startsWith('0x'));
      });
      expect(o.explanation_id).to.be.equal('flat_payment');
      expect(o.explanation_data).to.be.deep.equal({
        amount: '10000000000000000000',
        token: '0xB0427e9F03Eb448D030bE3EBC96F423857ceEb2f',
      });
    });
    const { rows: index } = await db.query('SELECT * FROM reward_root_index;');
    expect(index[0].reward_program_id).to.be.equal(rewardProgramId);
    expect(index[0].payment_cycle).to.be.equal(paymentCycle);
  });
  it('index old parquet file with no explanationId or explanationData column', async function () {
    const mockProofs = [
      {
        rewardProgramID: '0x0885ce31D73b63b0Fcb1158bf37eCeaD8Ff0fC72',
        paymentCycle: 27722077,
        validFrom: 27722077,
        validTo: 28499677,
        tokenType: 1,
        payee: '0x159ADe032073d930E85f95AbBAB9995110c43C71',
        root: '0x2c7f1466e5b1d6958e8cb52dab3cdcd115a52e7171ac5d70c6000648a0163c30',
        leaf: '0000000000000000000000000885ce31d73b63b0fcb1158bf37ecead8ff0fc720000000000000000000000000000000000000000000000000000000001a7015d0000000000000000000000000000000000000000000000000000000001a7015d0000000000000000000000000000000000000000000000000000000001b2dedd0000000000000000000000000000000000000000000000000000000000000001000000000000000000000000159ade032073d930e85f95abbab9995110c43c7100000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000040000000000000000000000000b0427e9f03eb448d030be3ebc96f423857ceeb2f0000000000000000000000000000000000000000000000008ac7230489e80000',
        proof: [{ item: '7019252fd21c2f404fb5834aa1a098b64a8c52504b9a83a25fdc732a3834c579' }],
      },
      {
        rewardProgramID: '0x0885ce31D73b63b0Fcb1158bf37eCeaD8Ff0fC72',
        paymentCycle: 27722077,
        validFrom: 27722077,
        validTo: 28499677,
        tokenType: 1,
        payee: '0x691fC14ed06A091e657b70ec9E5Eb72d17396694',
        root: '0x2c7f1466e5b1d6958e8cb52dab3cdcd115a52e7171ac5d70c6000648a0163c30',
        leaf: '0000000000000000000000000885ce31d73b63b0fcb1158bf37ecead8ff0fc720000000000000000000000000000000000000000000000000000000001a7015d0000000000000000000000000000000000000000000000000000000001a7015d0000000000000000000000000000000000000000000000000000000001b2dedd0000000000000000000000000000000000000000000000000000000000000001000000000000000000000000691fc14ed06a091e657b70ec9e5eb72d1739669400000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000040000000000000000000000000b0427e9f03eb448d030be3ebc96f423857ceeb2f0000000000000000000000000000000000000000000000008ac7230489e80000',
        proof: [{ item: '09741092149356a58c47dae710a25e0e05cda00b69e5f18d21c3674e360a83bd' }],
      },
    ];
    const mockData = mockResponse(mockProofs);
    s3Mock.on(SelectObjectContentCommand).resolves(mockData);
    const rewardProgramId = mockProofs[0].rewardProgramID;
    const paymentCycle = mockProofs[0].paymentCycle;
    let task = await getContainer().instantiate(ProcessRewardRoot);
    await task.perform({
      blockNumber: '1',
      rewardProgramId: rewardProgramId,
      paymentCycle: String(paymentCycle),
    });
    const { rows } = await db.query('SELECT * FROM reward_proofs;');
    expect(rows.length).to.be.equal(2);
    rows.map((o) => {
      expect(o.reward_program_id).to.be.equal(rewardProgramId);
      expect(o.payment_cycle).to.be.equal(paymentCycle);
      expect(o.leaf.startsWith('0x')).to.be.true;
      o.proof_bytes.map((p: string) => {
        expect(p.startsWith('0x'));
      });
      expect(o.explanation_id).to.be.null;
      expect(o.explanation_data).to.be.deep.equal({});
    });
    const { rows: index } = await db.query('SELECT * FROM reward_root_index;');
    expect(index[0].reward_program_id).to.be.equal(rewardProgramId);
    expect(index[0].payment_cycle).to.be.equal(paymentCycle);
  });
});
