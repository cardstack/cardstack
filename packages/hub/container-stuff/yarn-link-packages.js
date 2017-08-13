const { spawn } = require('child_process');
const { flatten, flattenDeep } = require('lodash');

const CONTAINER_YARN_LINK_DIR = "/usr/local/share/.config/yarn/link";

module.exports = {
  CONTAINER_YARN_LINK_DIR,
  linkUpPackages
};

function linkUpPackages(packages) {
  let package_volumes = flatten(packages.map(function(package) {
    let { path, name, volumeName } = package;
    return [
      '--mount', `type=bind,src=${path},dst=/packages/${name}`,
      '--mount', `type=volume,src=${volumeName},dst=/packages/${name}/node_modules`,
    ];
  }));

  let volumes = [
    '--mount', `type=volume,src=cardstack-yarn-link-dir,dst=${CONTAINER_YARN_LINK_DIR}`,
    ...package_volumes
  ];
  
  let global_link_commands = packages.reduce(function(links, package) {
    return [...links, `cd /packages/${package.name}`, "yarn link"];
  }, []);

  let link_in_commands = packages.reduce(function(link_commands, package) {
    return link_commands.concat(...package.links.map(function(link) {
      return [`cd /packages/${package.name}`, `yarn link ${link.name}`];
    }));
  }, []);

  let link_command = [
    ...global_link_commands,
    ...link_in_commands
  ].join(' && ');

  let docker_command = [
      'run',
      '--rm',
      ...volumes,
      'cardstack/hub',
      'sh', '-c', link_command
  ];

  console.log('running yarn linking', ['docker', ...docker_command].join(' '));
  let ln = spawn('docker', docker_command, { stdio: 'inherit' });

  return new Promise(function(resolve, reject) {
    ln.on('error', reject);
    ln.on('exit', function(code) {
      /*
      let inspect_command = [
          'docker',
          'run',
          '-it',
          '--rm',
          ...volumes,
          'cardstack/hub',
          'sh'].join(' ');
      console.log('inspect linking results:', inspect_command);
      */
      if (code === 0) {
        resolve();
      } else {
        reject(code);
      }
    });
  });
}
