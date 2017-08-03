const { spawn } = require('child_process');

module.exports = createElasticsearchService;

function createElasticsearchService() {

  let service = spawn('docker', [
      'service', 'create',
      '--detach=false',
      '--label', 'io.cardstack.hub',
      '--name', 'elasticsearch',
      '--network', 'thing',
      'cardstack/elasticsearch'
  ], { stdio: 'inherit' });

  return new Promise(function(resolve, reject) {
    service.on('error', reject);
    service.on('exit', function(code) {
      if (code === 0) {
        resolve();
      } else {
        reject(code);
      }
    });
  });
}
