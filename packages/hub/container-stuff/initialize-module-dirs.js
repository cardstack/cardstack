const { spawn, execSync } = require('child_process');
const path = require('path');

module.exports = {
  createInstalledVolumeFor,
  getCacheDir
};

function createInstalledVolumeFor(packagePath, volumeName) {

  let absolute_path = path.resolve(packagePath);

  let command_setup = ['run',
      '--rm',
      '--mount', `type=volume,src=cardstack-yarn-cache,dst=${getCacheDir()}`,
      '--mount', `type=bind,src=${absolute_path},dst=/package`,
      '--mount', `type=volume,src=${volumeName},dst=/package/node_modules`,
      '--workdir', '/package',
      'cardstack/hub'
  ];

  let install = spawn('docker', command_setup.concat('yarn', 'install', '--ignore-engines', '--pure-lockfile'), { stdio: 'inherit' });

  return new Promise(function(resolve, reject) {
    install.on('exit', function(code) {
      console.log('exit code:', code);
      if (code === 0) {
        resolve();
      } else {
        reject(code);
      }
    });
  });
}

let cacheDir;

function getCacheDir() {
  if (cacheDir) { return cacheDir; }
  return cacheDir = execSync("docker run --rm cardstack/hub yarn cache dir", { encoding: 'utf8' }).trim();
}

// let packages = [
//   'codegen',
//   'di',
//   'ephemeral',
//   'eslint-config',
//   'hub',
//   'jsonapi',
//   'test-support',
//   'tools'
// ];
// 
// packages.forEach(mod => createInstalledVolumeFor(`/Users/aaron/dev/cardstack/packages/${mod}`));
