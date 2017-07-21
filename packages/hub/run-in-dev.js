const { spawn } = require('child_process');
const path = require('path');

const packagePath="/Users/aaron/dev/cardstack/packages/hub"

function createInstalledVolumeFor(packagePath) {

  let absolute_path = path.resolve(packagePath);
  let module_name = path.basename(packagePath);

  let command_setup = ['run',
      '--rm',
      '--mount', `type=bind,src=${absolute_path},dst=/package`,
      '--mount', `type=volume,src=${module_name}-node_modules,dst=/package/node_modules`,
      '--workdir', '/package',
      'cardstack/hub'
  ];

  let install = spawn('docker', command_setup.concat('yarn', 'install'), { stdio: 'inherit' });

  install.on('exit', function(code) {
    console.log('exit code:', code);
    console.log(command_setup.concat('sh'));
  });

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
