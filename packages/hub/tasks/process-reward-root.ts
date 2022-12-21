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
interface S3FileInfo {
  rewardProgramId: string;
  paymentCycle: string;
}

//this is proof returned by parquet in json format
interface Proof {
  rewardProgramID: string;
  payee: string;
  leaf: string;
  paymentCycle: number;
  proof: string; // this will be converted to proof array
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
  async perform(file: S3FileInfo) {
    let currentBlockNumber = 0;
    try {
      currentBlockNumber = (await this.web3.getInstance().eth.getBlockNumber()) as number;
    } catch (e) {
      currentBlockNumber = 0;
    }
    const s3Config = await awsConfig({ roleChain: [] });
    const s3Client = new S3Client(s3Config);
    const db = await this.databaseManager.getClient();
    const proofs = await queryParquet(s3Client, file);
    const rows = proofs
      .filter(({ validTo }) => {
        return validTo > currentBlockNumber;
      }) //only index non expired proofs
      .map((o) => {
        return (
          '(' +
          pgFormat(
            '%L, %L, %L, %L, ARRAY[%L], %L, %L, %L, %L, %L',
            o.rewardProgramID,
            o.payee,
            o.leaf,
            o.paymentCycle,
            o.proof,
            o.tokenType,
            o.validFrom,
            o.validTo,
            o.explanationId,
            o.explanationData
          ) +
          ')'
        );
      });
    const indexQuery = 'INSERT INTO reward_root_index( reward_program_id, payment_cycle ) VALUES (%L, %L);';
    const indexSql = pgFormat(indexQuery, file.rewardProgramId, file.paymentCycle);
    try {
      if (rows.length > 0) {
        const proofsQuery = `
      INSERT INTO reward_proofs(
        reward_program_id, payee, leaf, payment_cycle, proof, token_type,  valid_from, valid_to, explanation_id, explanation_data
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
        log.info(`rewardProgramId: ${file.rewardProgramId}, paymentCycle: ${file.paymentCycle} is already indexed`);
        return;
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
  file: S3FileInfo,
  expression?: SelectObjectContentCommandInput['Expression']
): Promise<Proof[]> => {
  let records: Proof[] = [];
  const params: SelectObjectContentCommandInput = {
    Bucket: 'cardpay-staging-reward-programs',
    Key: `rewardProgramID=${file.rewardProgramId}/paymentCycle=${file.paymentCycle}/results.parquet`,
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
    for await (const event of events) {
      if (event?.Records) {
        if (event?.Records?.Payload) {
          const record = Buffer.from(event.Records.Payload).toString('utf8');
          const os = record.split('\n');
          os.map((o) => {
            if (o != '') {
              const b: any = JSON.parse(o);
              if (!('explanationData' in b)) {
                b.explanationData = '{}';
              }
              // when proof array serialize to json, it becomes [{item:... }. {item: ...}]
              // need to transform to array of hex strings
              b.proof = b.proof.length > 0 ? b.proof.map((o: any) => '0x' + o.item) : ['0x'];
              b.leaf = '0x' + b.leaf;
              records.push(b);
            }
          });
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
      return await queryParquet(s3Client, file, `SELECT ${FIELDS_EXCEPT_EXPLANATION_DATA} FROM s3object`);
    } else if (err.name == 'NoSuchKey') {
      log.info(
        `Key rewardProgramID=${file.rewardProgramId}/paymentCycle=${file.paymentCycle}/results.parquet does not exist`
      );
      return [];
    } else {
      log.error('error fetching data: ', err);
      throw err;
    }
  }
  return records;
};

export const scanParquet = async (s3Client: S3Client, files: S3FileInfo[]) => {
  const promises: Promise<Proof[]>[] = [];
  files.forEach((file) => {
    promises.push(queryParquet(s3Client, file));
  });
  const r = (await Promise.all(promises)).flat();
  return r;
};