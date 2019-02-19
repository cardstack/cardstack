const { Client, Pool } = require('pg');
const migrate = require('node-pg-migrate').default;
const { join } = require('path');
const postgresConfig = require('@cardstack/plugin-utils/postgres-config');
const log = require('@cardstack/logger')('cardstack/ethereum/transaction-index');
const EventEmitter = require('events');
const { upsert, queryToSQL, param } = require('@cardstack/pgsearch/util');
const { promisify } = require('util');
const sleep = promisify(setTimeout);

const config = postgresConfig({ database: `ethereum_index` });
const defaultProgressFrequency = 100;
const maxTransactionReceiptRetries = 100;

// Note that this class intentionally does not use DI, as we're trying to keep this module as thin
// as possible since it is run in a heavily parallelized fashion. DI can be used in child classes
// that extend this class that are not leveraged for the index building workers
module.exports = class TransactionIndexBase extends EventEmitter {
  constructor() {
    super();

    this.pool = new Pool({
      user: config.user,
      host: config.host,
      database: config.database,
      password: config.password,
      port: config.port
    });

    this._migrateDbPromise = null;
    this._didEnsureDatabaseSetup = false;
  }

  async ensureDatabaseSetup() {
    await this._setupPromise;

    if (this._didEnsureDatabaseSetup) { return; }

    if (!this._migrateDbPromise) {
      this._migrateDbPromise = this._setupMigrate();
    }
    let { jobCancelled } = await this._migrateDbPromise || {};
    if (jobCancelled && process.env.HUB_ENVIRONMENT !== 'test') {
      log.info('Another node process has run db-migrate. waiting a moment to ensure db-migrate has completed');
      await sleep(10000);
    }

    this._didEnsureDatabaseSetup = true;
  }

  async _setupMigrate() {
    throw new Error(`Please implement this method, '_setupMigrate()' in the TransactionIndexBase child class`);
  }

  async _migrateDb() {
    let client = new Client(Object.assign({}, config, { database: 'postgres' }));
    try {
      await client.connect();
      let response = await client.query(`select count(*)=1 as has_database from pg_database where datname=$1`, [config.database]);
      if (!response.rows[0].has_database) {
        await client.query(`create database ${this.safeDatabaseName(config.database)}`);
      }
    } finally {
      client.end();
    }

    await migrate({
      direction: 'up',
      migrationsTable: 'migrations',
      singleTransaction: true,
      checkOrder: false,
      databaseUrl: {
        user: config.user,
        host: config.host,
        database: config.database,
        password: config.password,
        port: config.port
      },
      dir: join(__dirname, 'migrations'),
      log: (...args) => log.debug(...args)
    });
  }

  async buildIndex({ fromBlockHeight=0, toBlockHeight='latest', jobName, progressFrequency }) {
    await this.ensureDatabaseSetup();
    let endHeight = toBlockHeight === 'latest' ? await this.ethereumClient.getBlockHeight() : toBlockHeight;
    let currentBlockNumber = fromBlockHeight;
    let workerAttribution = jobName ? `Worker ${jobName} - ` : '';
    let totalNumBlocks = endHeight - fromBlockHeight;
    while (currentBlockNumber <= endHeight) {
      let block;
      let blockRetries = 0;
      do {
        block = await this.ethereumClient.getBlock(currentBlockNumber);
        if (!block) {
          log.warning(`${workerAttribution}Warning, unable to retrieve block #${currentBlockNumber}, trying again (retries: ${blockRetries})`);
          await sleep(5000);
        } else if (block && blockRetries) {
          log.info(`${workerAttribution}successfully retrieved block #${currentBlockNumber} after ${blockRetries} retries.`);
        }
        blockRetries++;
      }
      while (!block);

      let currentNumBlocks = currentBlockNumber - fromBlockHeight;
      if (currentNumBlocks % (progressFrequency || defaultProgressFrequency) === 0) {
        let percentageComplete = Math.round(100 * (currentNumBlocks/totalNumBlocks));
        log.info(`${workerAttribution}Percent complete ${percentageComplete}%. ${currentNumBlocks} of ${totalNumBlocks} blocks. Processing block #${block.number}`);
      }
      log.debug(`${workerAttribution}Processing block #${block.number}, contains ${block.transactions.length} transactions`);
      for (let transaction of block.transactions) {
        log.trace(`  - ${workerAttribution}processing transaction #${transaction.transactionIndex}`);
        let receipt;
        let receiptRetries = 0;
        do {
          receipt = await this.ethereumClient.getTransactionReceipt(transaction.hash);
          if (!receipt) {
            log.warning(`${workerAttribution}Warning, no transaction receipt exists for txn hash ${transaction.hash}, trying again (retries: ${receiptRetries})`);
            await sleep(5000);
          } else if (receipt && receiptRetries) {
            log.info(`${workerAttribution}successfully retrieved receipt for txn hash ${transaction.hash} after ${receiptRetries} retries.`);
          }
          receiptRetries++;
        } while (!receipt || receiptRetries <= maxTransactionReceiptRetries);

        if (!receipt) {
          throw new Error(`Cannot retrieve transaction receipt for transaction hash ${transaction.hash} from the geth node. This is indicative of using a geth node that is not using '--syncmode "full"'. Make sure that your geth node is a full node.`);
        }

        let status = typeof receipt.status === 'boolean' ? receipt.status : Boolean(parseInt(receipt.status, 16));

        await this.query(queryToSQL(upsert('transactions', 'transactions_pkey', {
          transaction_hash:       param(transaction.hash),
          block_number:           param(block.number),
          block_hash:             param(block.hash),
          from_address:           param(transaction.from),
          to_address:             param(transaction.to),
          transaction_value:      param(transaction.value),
          timestamp:              param(block.timestamp),
          transaction_nonce:      param(transaction.nonce),
          transaction_index:      param(transaction.transactionIndex),
          gas:                    param(transaction.gas),
          gas_price:              param(transaction.gasPrice),
          gas_used:               param(receipt.gasUsed),
          cumulative_gas_used:    param(receipt.cumulativeGasUsed),
          transaction_successful: param(status),
        })));
      }
      endHeight = toBlockHeight === 'latest' ? await this.ethereumClient.getBlockHeight() : toBlockHeight;
      currentBlockNumber++;
    }
    return endHeight;
  }

  async query(...args) {
    let client = await this.pool.connect();
    try {
      return await client.query(...args);
    }
    finally {
      client.release();
    }
  }

  safeDatabaseName(name) {
    if (!/^[a-zA-Z_0-9]+$/.test(name)) {
      throw new Error(`unsure if db name ${name} is safe`);
    }
    return name;
  }
};
