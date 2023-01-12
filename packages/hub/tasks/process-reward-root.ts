import {
  S3Client,
  SelectObjectContentCommand,
  SelectObjectContentEventStream,
  SelectObjectContentCommandInput,
} from '@aws-sdk/client-s3';
import { inject } from '@cardstack/di';
import pgFormat from 'pg-format';
import awsConfig from '../utils/aws-config';
import Logger from '@cardstack/logger';
import config from 'config';

export interface ProcessRewardRootPayload {
  rewardProgramId: string;
  paymentCycle: string;
  blockNumber: string;
}

//this is proof returned by parquet in json format
interface Proof {
  rewardProgramID: string;
  payee: string;
  leaf: string;
  paymentCycle: number;
  proofBytes: string[];
  tokenType: string;
  validFrom: number;
  validTo: number;
  explanationId: string[];
  explanationData: string;
}

let log = Logger('task:process-reward-root');
export default class ProcessRewardRoot {
  private databaseManager = inject('database-manager', { as: 'databaseManager' });
  web3 = inject('web3-http', { as: 'web3' });
  async perform(payload: ProcessRewardRootPayload) {
    let currentBlockNumber = 0;
    try {
      currentBlockNumber = (await this.web3.getInstance().eth.getBlockNumber()) as number;
    } catch (e) {
      currentBlockNumber = 0;
    }
    const s3Config = await awsConfig({ roleChain: [] });
    const s3Client = new S3Client(s3Config);
    const db = await this.databaseManager.getClient();
    const bucketName = config.get('aws.rewards.bucketName') as string;
    const proofs = await queryParquet(s3Client, bucketName, payload.rewardProgramId, payload.paymentCycle);
    const rows = proofs
      .filter(({ validTo }) => {
        return validTo > currentBlockNumber;
      }) //only index non expired proofs
      .map((o) => {
        return (
          '(' +
          pgFormat(
            '%L, %L, %L, %L, ARRAY[%L]::text[], %L, %L, %L, %L, %L',
            o.rewardProgramID,
            o.payee,
            o.leaf,
            o.paymentCycle,
            o.proofBytes,
            o.tokenType,
            o.validFrom,
            o.validTo,
            o.explanationId,
            o.explanationData
          ) +
          ')'
        );
      });
    const indexQuery =
      'INSERT INTO reward_root_index( reward_program_id, payment_cycle, block_number ) VALUES (%L, %L, %L);';
    const indexSql = pgFormat(indexQuery, payload.rewardProgramId, payload.paymentCycle, payload.blockNumber);
    try {
      if (rows.length > 0) {
        const proofsQuery = `
      INSERT INTO reward_proofs(
        reward_program_id, payee, leaf, payment_cycle, proof_bytes, token_type,  valid_from, valid_to, explanation_id, explanation_data
      ) VALUES %s;
    `;
        const proofsSql = pgFormat(proofsQuery, rows.join());

        await this.databaseManager.performTransaction(db, async () => {
          await db.query(indexSql);
          const r = await db.query(proofsSql);
          log.info(`Insert ${r.rowCount} notification_types rows`);
        });
      } else {
        await db.query(indexSql);
        //will rememeber root  as indexed
        //although no proofs (cause their expired) are stored in db
      }
    } catch (e: any) {
      if (e.code == '23505') {
        // do not scream errors when indexing
        log.info(
          `rewardProgramId: ${payload.rewardProgramId}, paymentCycle: ${payload.paymentCycle} is already indexed`
        );
        return;
      } else {
        throw e;
      }
    }
  }
}

declare module '@cardstack/hub/tasks' {
  interface KnownTasks {
    'process-reward-root': ProcessRewardRoot;
  }
}

const FIELDS_EXCEPT_EXPLANATION_DATA =
  'rewardProgramID,paymentCycle,validFrom,validTo,tokenType,payee,root,leaf,proof,explanationId';

const queryParquet = async (
  s3Client: S3Client,
  bucketName: string,
  rewardProgramId: string,
  paymentCycle: string,
  expression?: SelectObjectContentCommandInput['Expression']
): Promise<Proof[]> => {
  let records: Proof[] = [];
  const params: SelectObjectContentCommandInput = {
    Bucket: bucketName,
    Key: `rewardProgramID=${rewardProgramId}/paymentCycle=${paymentCycle}/results.parquet`,
    ExpressionType: 'SQL',
    Expression: expression ?? 'SELECT * FROM S3Object',
    InputSerialization: {
      Parquet: {}, //no parameters needed here
    },
    OutputSerialization: {
      JSON: {
        RecordDelimiter: '\n', //each row can be separated by splitting \n
      },
    },
  };
  try {
    const command = new SelectObjectContentCommand(params);
    const s3Data = await s3Client.send(command);

    if (!s3Data.Payload) {
      throw new Error('payload undefined');
    }
    const events: AsyncIterable<SelectObjectContentEventStream> = s3Data.Payload;
    let tail: string | undefined;
    let head: string | undefined;
    for await (const event of events) {
      if (event?.Records) {
        if (event?.Records?.Payload) {
          const record = Buffer.from(event.Records.Payload).toString('utf8');

          const os = record.split('\n');
          // the records cut off at 65000 bytes ie UintArray(65000).
          // The tail is meant to be the string from the last paginate  that got cutoff
          tail = event.Records.Payload.length == 65000 ? os.pop() : undefined;

          os.map((x, i) => {
            if (x != '') {
              let o = i == 0 && head != undefined ? head + x : x;
              const b: any = JSON.parse(o);
              if (!('explanationData' in b)) {
                b.explanationData = '{}';
              }
              // when proof array serialize to json, it becomes [{item:... }. {item: ...}]
              // need to transform to array of hex strings
              // - parquet file names column as proof
              // - database and process names column as proofBytes
              b.proofBytes = b.proof.map((o: any) => '0x' + o.item);
              b.leaf = '0x' + b.leaf;
              records.push(b);
            }
          });
          head = tail ?? undefined;
        } else {
          log.info('skipped event, payload: ', event?.Records?.Payload);
        }
      } else if (event.Stats) {
        log.info(`Processed ${event.Stats.Details?.BytesProcessed} bytes`);
      } else if (event.End) {
        log.info('SelectObjectContent completed');
      }
    }
  } catch (err: any) {
    if (err.name == 'UnsupportedParquetType') {
      return await queryParquet(
        s3Client,
        bucketName,
        rewardProgramId,
        paymentCycle,
        `SELECT ${FIELDS_EXCEPT_EXPLANATION_DATA} FROM s3object`
      );
    } else if (err.name == 'NoSuchKey') {
      log.info(`Key rewardProgramID=${rewardProgramId}/paymentCycle=${paymentCycle}/results.parquet does not exist`);
      return [];
    } else {
      log.error('error fetching data: ', err);
      throw err;
    }
  }
  return records;
};
