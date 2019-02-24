const Queue = require('@cardstack/queue');
const TransactionIndexBase = require('./transaction-index-base');
const postgresConfig = require('@cardstack/plugin-utils/postgres-config');
const EthereumClient = require('./client');

const pgbossConfig = postgresConfig({ database: `pgboss_${process.env.HUB_ENVIRONMENT}` });
module.exports = class TransactionIndexBuilder extends TransactionIndexBase {
  constructor(jsonRpcUrl) {
    super();

    this.jobQueue = new Queue(pgbossConfig);

    if (jsonRpcUrl) {
      this.ethereumClient = EthereumClient.create();
      this.ethereumClient.connect(jsonRpcUrl);
    }
  }

  get canFailoverEthereumClient() {
    return false;
  }

  async _setupMigrate() {
    await this.jobQueue.subscribe("ethereum/transaction-index/migrate-db", async () => {
      await this._migrateDb();
    });
    await this.jobQueue.publishAndWait('ethereum/transaction-index/migrate-db', {}, {
      singletonKey: 'ethereum/transaction-index/migrate-db',
      singletonMinutes: 10
    });
  }
};