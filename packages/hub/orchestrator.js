const util = require('util');
const child_process = require('child_process');
const getContainerId = require('docker-container-id');
const request = require('superagent');
const log = require('@cardstack/plugin-utils/logger')('orchestrator');
const timeout = require('util').promisify(setTimeout);
const execFile = util.promisify(child_process.execFile);

const NETWORK_NAME = "cardstack-network";
const ELASTICSEARCH_STARTUP_TIMEOUT = 60 * 1000; // 60 seconds


module.exports = {
  async start() {
    await ensureNetwork();
    await ensureElasticsearch();
    log.info('Docker orchestration is finished, everything should be in order');
  },

  async stop() {
    await destroyElasticsearch();
    await destroyNetwork();
    log.info('All other docker artifacts successfully removed. Shutting down...');
    process.exit();
  }
};



async function ensureNetwork() {
  try {
    await execFile('docker', ['network', 'create', NETWORK_NAME]);
  } catch (error) {
    // We probably just failed here because the network already exists
    if (error.code === 1) {
      log.warn('Error creating docker network:');
      log.warn(error.stderr);
    } else {
      throw error;
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
  await execFile('docker', [
      'run',
      '-d',
      '--rm',
      '--network', NETWORK_NAME,
      '--network-alias', 'elasticsearch',
      '--label', 'com.cardstack.service=elasticsearch',
      '--publish', '9200:9200',
      'cardstack/elasticsearch'
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


