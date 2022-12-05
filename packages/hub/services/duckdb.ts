import { Database } from 'duckdb-async';
import config from 'config';
import awsConfig, { AwsConfigResult } from '../utils/aws-config';
import logger from '@cardstack/logger';

const log = logger('hub/duckdb');

interface s3FileInfo {
  rewardProgramId: string;
  paymentCycle: number;
}

const REQUIRED_DUCKDB_EXTENSIONS = ['httpfs']; //httpfs needed for s3. parquet extension already built in

export default class DuckDB {
  private db: Database | undefined;
  private awsConfig: AwsConfigResult | undefined;

  async getClient(setAws: boolean = true) {
    if (!this.db) {
      this.db = await Database.create(':memory');
    }
    await this.setupExtensions(this.db);
    if (setAws) {
      await this.setupAws(this.db);
    }
    return this.db;
  }

  async queryParquet(db: Database, files: s3FileInfo[]) {
    if (!this.awsConfig) {
      await this.setupAws(db);
    }
    // For example, 's3://cardpay-staging-reward-programs/rewardProgramID=0x0885ce31D73b63b0Fcb1158bf37eCeaD8Ff0fC72/paymentCycle=27603400/results.parquet', 's3://cardpay-staging-reward-programs/rewardProgramID=0x0885ce31D73b63b0Fcb1158bf37eCeaD8Ff0fC72/paymentCycle=27625500/results.parquet'
    const s3Urls: string[] = files.map(({ rewardProgramId, paymentCycle }) => {
      return `s3://cardpay-staging-reward-programs/rewardProgramID=${rewardProgramId}/paymentCycle=${paymentCycle}/results.parquet`;
    });
    const sql = `                                                                                                                                                                                          
      SELECT * FROM parquet_scan(${s3Urls});                                   
    `;
    return this.query(db, sql);
  }
  async query(db: Database, sqlQuery: string) {
    return db.all(sqlQuery);
  }

  async setupExtensions(db: Database) {
    const listedExtensions = await this.listExtensions(db);

    return REQUIRED_DUCKDB_EXTENSIONS.map(async (extensionName: string) => {
      if (!this.extensionInstalled(listedExtensions, extensionName)) {
        log.info(`Installing ${extensionName} extension`);
        await db.run(`INSTALL ${extensionName}`);
      }
      if (!this.extensionLoaded(listedExtensions, extensionName)) {
        log.info(`Loading ${extensionName} extension`);
        await db.run(`LOAD ${extensionName}`);
      }
    });
  }

  extensionInstalled(extensions: any[], extensionName: string) {
    const o = extensions.find((o) => o.extension_name === extensionName);
    return o.installed;
  }

  extensionLoaded(extensions: any[], extensionName: string) {
    const o = extensions.find((o) => o.extension_name === extensionName);
    return o.loaded;
  }

  async setupAws(db: Database) {
    const s3Config = await awsConfig({
      roleChain: config.get('aws.offchainStorage.rewardsRoleChain'),
    });
    return Promise.all([
      db.run(`SET s3_region='${s3Config.region}'`),
      db.run(`SET s3_access_key_id='${s3Config.credentials.accessKeyId}';`),
      db.run(`SET s3_secret_access_key='${s3Config.credentials.secretAccessKey}';`),
      db.run(`SET s3_session_token='${s3Config.credentials.sessionToken}';`),
    ]);
  }

  async listExtensions(db: Database) {
    return db.all(`select * from duckdb_extensions();`);
  }

  async teardown() {
    if (!this.db) {
      return;
    } else {
      return this.db.close();
    }
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    duckDB: DuckDB;
  }
}
