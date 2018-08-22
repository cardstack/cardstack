const { Client } = require('pg');
const PgBoss = require('pg-boss');
const log = require('@cardstack/logger')('cardstack/queue');

module.exports = class Queue {
  constructor(config) {
    this.boss = null;
    this.promiseResolveCallbacks = {};
    this.promiseRejectCallbacks = {};
    this.callbackedQueues = [];
    this.jobErrors = {};
    this.config = config;
  }

  async _ensureDatabaseSetup() {
    let client = new Client(Object.assign({}, this.config, { database: 'postgres' }));
    try {
      await client.connect();
      let response = await client.query(`select count(*)=1 as has_database from pg_database where datname=$1`, [this.config.database]);
      if (!response.rows[0].has_database) {
        await client.query(`create database ${safeDatabaseName(this.config.database)}`);
      }
    } finally {
      client.end();
    }
  }

  async _ensureBoss() {
    if (!this.boss) {
      await this._ensureDatabaseSetup();
      this.boss = new PgBoss(this.config);
      await this.boss.start();
      log.debug("Boss started");
    }
  }

  async stop() {
    if (this.boss) {
      await this.boss.stop();
      log.debug("Boss stopped");
      this.boss = null;
    }
  }

  async publish(jobName, ...options) {
    await this._ensureBoss();
    let jobId = await this.boss.publish(jobName, ...options);
    log.debug(`Published new job ${jobId} to queue ${jobName}`);
    return jobId;
  }

  async publishAndWait(jobName, ...options) {
    let jobId = await this.publish(jobName, ...options);

    this._setupCallbacks(jobName);

    return new Promise((resolve, reject) => {
      this.promiseResolveCallbacks[jobId] = resolve;
      this.promiseRejectCallbacks[jobId] = reject;
    });
  }

  async subscribe(jobName, handler, options={}) {
    log.debug(`Subscribing to queue ${jobName}`);

    await this._ensureBoss();

    // handlers in boss use a callback style. Wrapping allows a promise style
    // in handlers instead of having to deal with an old-style done callback
    let wrappedHander = async (job, done) => {
      log.debug(`Processing job ${job.id} from queue ${jobName}`);
      let result;

      try {
        result = await handler(job);
      } catch (e) {
        log.debug(`Error occurred during proccesing of job ${job.id}: ${e.message}`);
        this.jobErrors[job.id] = e;
        done(e);
        return;
      }
      log.debug(`Processing complete of ${job.id} from queue ${jobName}`);
      done(null, result);
    };

    // boss uses a different argument order and options is optional, this
    // is weird, as why would you ever subscribe without a handler?

    // I'm switching the argument order to simplify things
    return await this.boss.subscribe(jobName, options, wrappedHander);
  }


  _setupCallbacks(jobName) {
    if (this.callbackedQueues.includes(jobName)) {
      return;
    }

    this.boss.onComplete(jobName, job => {
      let promiseResolve = this.promiseResolveCallbacks[job.data.request.id];
      this._cleanupJob(job.data.request.id);
      promiseResolve(job);
    });
    this.boss.onFail(jobName, job => {
      let promiseReject = this.promiseRejectCallbacks[job.data.request.id];
      let error = this.jobErrors[job.data.request.id];
      this._cleanupJob(job.data.request.id);
      promiseReject(error);
    });

    this.callbackedQueues.push(jobName);
  }

  _cleanupJob(jobId) {
    delete this.jobErrors[jobId];
    delete this.promiseResolveCallbacks[jobId];
    delete this.promiseRejectCallbacks[jobId];
  }
};

function safeDatabaseName(name){
  if (!/^[a-zA-Z_0-9]+$/.test(name)){
    throw new Error(`unsure if db name ${name} is safe`);
  }
  return name;
}
