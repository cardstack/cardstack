const {spawn} = require('child_process');

module.exports = function(service_options=[], spawn_options={}) {
  return new Promise(function(resolve, reject) {
    let command = [
        'service', 'create',
        '--detach=false',
        '--label', 'io.cardstack.hub',
        '--network', 'thing',
        ...service_options
    ];

    console.log("Spawning docker service:", ['docker', ...command].join(' '));
    let service = spawn('docker', command, spawn_options);

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
