const util = require('util');
const child_process = require('child_process');
const getContainerId = require('docker-container-id');
const request = require('superagent');
const log = require('@cardstack/logger')('cardstack/orchestrator');
const timeout = require('util').promisify(setTimeout);
const execFile = util.promisify(child_process.execFile);

const NETWORK_NAME = "cardstack-network";
const ELASTICSEARCH_STARTUP_TIMEOUT = 60 * 1000; // 60 seconds


module.exports = class Orchestrator {
  constructor(leaveRunning) {
    this.leaveRunning = leaveRunning;

    this.ready = new Promise((resolve, reject) => {
      this._resolveReady = resolve;
      this._rejectReady = reject;
    });
  }

  async start() {
    await ensureNetwork();
    await ensureElasticsearch();
    log.info('Docker orchestration is finished, everything should be in order');
    this._resolveReady();
  }

  async stop() {
    if (this.leaveRunning) {
      log.info('Leaving other docker artifacts intact. Shutting down...');
      process.exit();
    } else {
      await destroyElasticsearch();
      await destroyNetwork();
      log.info('All other docker artifacts successfully removed. Shutting down...');
      process.exit();
    }
  }
};



async function ensureNetwork() {
  try {
    await execFile('docker', ['network', 'create', NETWORK_NAME]);
  } catch (e) {
    // We probably just failed here because the network already exists
    if (e.stderr.indexOf('already exists')) {
      log.info('Docker network already exists, re-using it');
    } else {
      throw e;
    }
  }

  let own_id = await getContainerId();

  await execFile('docker', ['network', 'connect', NETWORK_NAME, own_id]);
}

async function destroyNetwork() {
  let own_id = await getContainerId();

  await execFile('docker', ['network', 'disconnect', NETWORK_NAME, own_id]);
  await execFile('docker', ['network', 'rm', NETWORK_NAME]);
}


async function ensureElasticsearch() {
  if (await isElasticsearchReady()) {
    log.info('Found existing elasticsearch container, will try to re-use it');
    return;
  }

  await execFile('docker', [
      'run',
      '-d',
      '--network', NETWORK_NAME,
      '--network-alias', 'elasticsearch',
      '--label', 'com.cardstack',
      '--label', 'com.cardstack.service=elasticsearch',
      '--publish', '9200:9200',
      'cardstack/elasticsearch:dev'
  ]);

  log.info('Waiting for elasticsearch container to start up...');

  let begin_time = Date.now();
  let end_time = begin_time + ELASTICSEARCH_STARTUP_TIMEOUT;

  while (Date.now() < end_time) {
    if (await isElasticsearchReady()) {
      let startup_time = Date.now() - begin_time;
      log.debug(`Elasticsearch now serving requests, after ${Math.round(startup_time / 1000)} seconds`);
      return;
    } else {
      log.trace('elasticsearch not responsive yet...');
      await timeout(500);
    }
  }
  throw `Elasticsearch container not accepting requests after ${ELASTICSEARCH_STARTUP_TIMEOUT}ms.`;
}

function isElasticsearchReady() {
  return new Promise(function (resolve) {
    request
      .get('http://elasticsearch:9200')
      .end(function(err) {
        if(err) {
          resolve(false);
        } else {
          resolve(true);
        }
      });
  });
}

async function destroyElasticsearch() {
  let container_id = await getServiceContainerId('elasticsearch');

  await execFile('docker', ['stop', container_id]);
}

async function getServiceContainerId(serviceName) {
  let {stdout} = await execFile('docker', ['ps', '-q', '-f', `label=com.cardstack.service=${serviceName}`]);
  return stdout.trim();
}


