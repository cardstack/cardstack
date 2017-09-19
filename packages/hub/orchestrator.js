const {spawn, exec} = require('child_process');
const getContainerId = require('docker-container-id');
const request = require('superagent');
const log = require('@cardstack/plugin-utils/logger')('orchestrator');
const timeout = require('util').promisify(setTimeout);

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
  await new Promise(function(resolve) {
    let proc = spawn('docker', [
        'network', 'create', NETWORK_NAME
    ], {stdio: 'inherit'});
    proc.on('exit', resolve);
  });

  let own_id = await getContainerId();

  await new Promise(function(resolve) {
    let proc = spawn('docker', [
        'network', 'connect', NETWORK_NAME, own_id
    ], {stdio: 'inherit'});
    proc.on('exit', resolve);
  });
}

async function destroyNetwork() {
  let own_id = await getContainerId();

  await new Promise(function(resolve) {
    let proc = spawn('docker', [
        'network', 'disconnect', NETWORK_NAME, own_id
    ], {stdio: 'inherit'});
    proc.on('exit', resolve);
  });

  await new Promise(function(resolve) {
    let proc = spawn('docker', [
        'network', 'rm', NETWORK_NAME
    ], {stdio: 'inherit'});
    proc.on('exit', resolve);
  });
}


async function ensureElasticsearch() {
  return new Promise(async function(resolve, reject) {
    let proc = spawn('docker', [
        'run',
        '-d',
        '--rm',
        '--network', NETWORK_NAME,
        '--network-alias', 'elasticsearch',
        '--label', 'com.cardstack.service=elasticsearch',
        '--publish', '9200:9200',
        'cardstack/elasticsearch'
    ], { stdio: 'inherit' });

    proc.on('error', reject);
    proc.on('exit', function(code) {
      if (code !== 0) {
        reject("Attempt to run elasticsearch exited with code: "+code);
      }
    });

    let begin_time = Date.now();
    let end_time = begin_time + ELASTICSEARCH_STARTUP_TIMEOUT;

    log.info('Waiting for elasticsearch container to start up...');

    while (Date.now() < end_time) {
      if (await isElasticsearchReady()) {
        let startup_time = Date.now() - begin_time;
        log.debug('elasticsearch now serving requests, after '+Math.round(startup_time / 1000)+' seconds');
        resolve();
        return;
      } else {
        log.trace('elasticsearch not responsive yet...');
        await timeout(500);
      }
    }
    reject("Elasticsearch container not accepting requests after "+ELASTICSEARCH_STARTUP_TIMEOUT+"ms.");
  });
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

  return new Promise(function(resolve, reject) {
    let proc = spawn('docker', [
        'stop', container_id
    ], { stdio: 'inherit' });
    proc.on('exit', resolve);
  });
}

function getServiceContainerId(serviceName) {
  return new Promise(function(resolve, reject) {
    exec(
      `docker ps -q -f "label=com.cardstack.service=${serviceName}"`,
      function(err, output) {
        if (err) {
          reject(err);
        } else {
          resolve(output.trim());
        }
      }
    );
  });
}


