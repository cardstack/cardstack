const { basename } = require('path');
const { spawn } = require('child_process');
const { flatten, flattenDeep } = require('lodash');

module.exports = symlinkPackages;

// symlinkPackages([
//     {
//       name: "app",
//       volumeName: "app-modules",
//       links: [
//         { name: "dep", package: "dep" },
//         { name: "dep2", package: "dep" },
//         { name: "@cardstack/dep", package: "@cardstack/dep" }
//       ]
//     },
//     {
//       name: "dep",
//       volumeName: "dep-modules",
//       links: []
//     },
//     {
//       name: "@cardstack/dep",
//       volumeName: "cardstack-dep-modules",
//       links: []
//     }
// ]);


function symlinkPackages(packages) {
  let volumes = flatten(packages.map(function(p) {
    return ['--mount', `type=volume,src=${p.volumeName},dst=/packages/${p.name}/node_modules`];
  }));

  let link_command = flattenDeep(packages.map(function(p) {
    return p.links.map(function(l) {
      return [
        `mkdir -p /packages/${p.name}/node_modules/${l.name}`,
        `rm -r /packages/${p.name}/node_modules/${l.name}`, // creates all parent dirs, but deletes the leaf one. Mostly for handling scoped packages.
        `ln -sfnv /packages/${l.package} /packages/${p.name}/node_modules/${l.name}`
      ];
    });
  }));

  let docker_setup = ['run',
      '--rm',
      ...volumes,
      '--workdir', '/packages'];

  let docker_command = [
      ...docker_setup,
      'cardstack/hub',
      'sh', '-c', link_command.join(' && ')];

  let ln = spawn('docker', docker_command, { stdio: 'inherit' });

  return new Promise(function(resolve, reject) {
    ln.on('error', reject);
    ln.on('exit', function(code) {
      let inspect_command = [
          'docker',
          ...docker_setup,
          '-it',
          'cardstack/hub',
          'sh'].join(' ');
      console.log('inspect linking results:', inspect_command);
      if (code === 0) {
        resolve();
      } else {
        reject(code);
      }
    });
  });

  /*
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
  */
}
