const { Pool, Client } = require('pg');
const migrate = require('node-pg-migrate').default;
const { join } = require('path');
const postgresConfig = require('@cardstack/plugin-utils/postgres-config');
const log = require('@cardstack/logger')('cardstack/ethereum/index');
const EthereumClient = require('./client');
const Queue = require('@cardstack/queue');
const { upsert, queryToSQL, param } = require('@cardstack/pgsearch/util');
const { promisify } = require('util');
const sleep = promisify(setTimeout);

const config = postgresConfig({ database: `ethereum_index` });
const pgbossConfig = postgresConfig({ database: `pgboss_${process.env.HUB_ENVIRONMENT}` });
const defaultProgressFrequency = 100;

module.exports = class TransactionIndex {
  constructor(jsonRpcUrl='ws://localhost:8546') {
    this.pool = new Pool({
      user: config.user,
      host: config.host,
      database: config.database,
      password: config.password,
      port: config.port
    });

    this._migrateDbPromise = null;
    this._didEnsureDatabaseSetup = false;
    this.ethereumClient = EthereumClient.create();
    this.ethereumClient.connect(jsonRpcUrl);
    this.jobQueue = new Queue(pgbossConfig);
  }

  async ensureDatabaseSetup() {
    if (this._didEnsureDatabaseSetup) { return; }

    if (!this._migrateDbPromise) {
      this._migrateDbPromise = this._runMigrateDb();
    }
    await this._migrateDbPromise;

    this._didEnsureDatabaseSetup = true;
  }

  async _runMigrateDb() {
    await this.jobQueue.subscribe("ethereum/transaction-index/migrate-db", async () => {
      await this._migrateDb();
    });

    await this.jobQueue.publishAndWait('ethereum/transaction-index/migrate-db', null,
      { singletonKey: 'ethereum/transaction-index/migrate-db', singletonNextSlot: true });
  }

  async _migrateDb() {
    let client = new Client(Object.assign({}, config, { database: 'postgres' }));
    try {
      await client.connect();
      let response = await client.query(`select count(*)=1 as has_database from pg_database where datname=$1`, [config.database]);
      if (!response.rows[0].has_database) {
        await client.query(`create database ${safeDatabaseName(config.database)}`);
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
    let endHeight = toBlockHeight === 'latest' ? await this.ethereumClient.getBlockHeight() : toBlockHeight;
    let currentBlockNumber = fromBlockHeight;
    let workerAttribution = jobName ? `Worker ${jobName} - ` : '';
    let totalNumBlocks = endHeight - fromBlockHeight;
    while (currentBlockNumber <= endHeight) {
      let block;
      let retries = 0;
      while (!block) {
        block = await this.ethereumClient.getBlock(currentBlockNumber);
        if (block && retries) {
          log.info(`${workerAttribution}successfully retrieved block #${currentBlockNumber} after ${retries} retries.`);
        }
        if (!block) {
          log.error(`${workerAttribution}Unable to retrieve block #${currentBlockNumber}, trying again (retries: ${retries})`);
          await sleep(5000);
        }
        retries++;
      }
      let currentNumBlocks = currentBlockNumber - fromBlockHeight;
      if (currentNumBlocks % (progressFrequency || defaultProgressFrequency) === 0) {
        let percentageComplete = Math.round(100 * (currentNumBlocks/totalNumBlocks));
        log.info(`${workerAttribution}Percent complete ${percentageComplete}%. ${currentNumBlocks} of ${totalNumBlocks} blocks. Processing block #${block.number}`);
      }
      log.debug(`${workerAttribution}Processing block #${block.number}, contains ${block.transactions.length} transactions`);
      for (let transaction of block.transactions) {
        log.trace(`  - ${workerAttribution}processing transaction #${transaction.transactionIndex}`);
        let receipt = await this.ethereumClient.getTransactionReceipt(transaction.hash);
        if (!receipt) {
          throw new Error(`${workerAttribution}No transaction reciept exists for txn hash ${transaction.hash}`);
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
};

function safeDatabaseName(name){
  if (!/^[a-zA-Z_0-9]+$/.test(name)){
    throw new Error(`unsure if db name ${name} is safe`);
  }
  return name;
}